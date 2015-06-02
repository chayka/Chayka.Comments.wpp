'use strict';

angular.module('chayka-comments', ['chayka-forms', 'chayka-buttons', 'chayka-modals', 'chayka-spinners', 'chayka-ajax',
    'chayka-translate', 'chayka-utils', 'chayka-avatars'])
    .factory('wpComments', ['ajax', 'utils', function(ajax, utils){

        var commentsQueue = {};

        var commentsByPostId = {};

        var commentsByParentId = {};

        var commentsById = {};

        var bulkDelay = 100;

        var commentsTimeout = null;

        var wpComments = {

            /**
             * Get current user
             * @return {*}
             */
            getCurrentUser: function(){
                return utils.getItem(window, 'Chayka.Users.currentUser', {id: 0, role: 'guest'});
            },

            /**
             * Check if current user is administrator
             * @return {boolean}
             */
            isCurrentUserAdmin: function(){
                var user = wpComments.getCurrentUser();
                return user.role === 'administrator';
            },

            /**
             * Check if current user logged in
             * @return {boolean}
             */
            isCurrentUserLoggedIn: function(){
                var user = wpComments.getCurrentUser();
                return !!user.id;
            },

            /**
             * Get empty comment model
             *
             * @param postId
             * @param [parentCommentId]
             * @return {{id: number, comment_post_ID: *, comment_author: *, comment_author_email: *, comment_author_url: *, user_id: number, comment_content: string, comment_karma: number, comment_karma_delta: number, comment_approved: number, comment_agent: *, comment_type: string, comment_date: string, comment_date_gmt: string, meta: {fb_user_id: *}}}
             */
            getEmptyComment: function(postId, parentCommentId){
                parentCommentId = parentCommentId || 0;
                var user = wpComments.getCurrentUser();
                var isLoggedIn = !!parseInt(user.id);
                var now = new Date();
                return {
                    id: 0,
                    comment_post_ID: postId,
                    comment_author: isLoggedIn?user.display_name||user.user_login : '',
                    comment_author_email: isLoggedIn?user.user_email : '',
                    comment_author_url: isLoggedIn?user.user_url : '',
                    user_id: parseInt(user.id),
                    comment_content: '',
                    comment_karma: 0,
                    comment_karma_delta: 0,
                    comment_approved: 0,
                    comment_parent: parentCommentId,
                    comment_type: '',
                    comment_date: now.toString(),
                    comment_date_gmt: now.toString(),
                    meta:{
                        fb_user_id: utils.getItem(user, 'meta.fb_user_id', 0)
                    }
                };
            },

            /**
             * Index comment for it can be found by id
             *
             * @param comment
             */
            indexComment: function(comment){
                if(commentsById[comment.id]){
                    angular.extend(commentsById[comment.id], comment);
                }else{
                    commentsById[comment.id] = comment;
                    if(commentsByPostId[comment.comment_post_ID]){
                        commentsByPostId[comment.comment_post_ID].push(comment);
                    }
                    var parentId = comment.comment_parent;
                    if(parentId){
                        if(!commentsByParentId[parentId]){
                            commentsByParentId[parentId] = [];
                        }
                        commentsByParentId[parentId].push(comment);
                    }
                }
            },

            /**
             * Remove comment from all indices, and process child-parent relations
             *
             * @param comment
             */
            removeComment: function(comment){
                /**
                 * Moving children one level up (that what wordpress does on backend)
                 */
                for(var id in commentsById){
                    if(commentsById.hasOwnProperty(id) && commentsById[id].comment_parent === comment.id){
                        commentsById[id].comment_parent = comment.comment_parent;
                    }
                }
                /**
                 * Remove comment from commentsByPostId
                 */
                var index;
                if(commentsByPostId[comment.comment_post_ID]) {
                    index = commentsByPostId[comment.comment_post_ID].indexOf(comment);
                    if (index > 0) {
                        commentsByPostId[comment.comment_post_ID].splice(index, 1);
                    }
                }

                /**
                * Remove comment from commentsByParentId
                */
                if(comment.comment_parent && commentsByParentId[comment.comment_parent]) {
                    index = commentsByParentId[comment.comment_parent].indexOf(comment);
                    if (index > 0) {
                        commentsByParentId[comment.comment_parent].splice(index, 1);
                    }
                }

                /**
                 * Remove comment from commentsById
                 */
                commentsById[comment.id] = null;
            },

            /**
             * Resolve media object by API and pass it to callback.
             * This function pushes request to the queue to perform bulk api call
             * @param {int} id
             * @param {function} callback
             * @param {int} [delay]
             */
            getCommentById: function(id, callback, delay){
                if(commentsById[id]){
                    callback(commentsById[id]);
                    return;
                }
                if(!commentsQueue[id]){
                    commentsQueue[id] = [];
                }
                commentsQueue[id].push(callback);
                if(commentsTimeout){
                    clearTimeout(commentsTimeout);
                }
                commentsTimeout = setTimeout(wpComments.bulkResolveCommentsById, delay || bulkDelay);
            },

            /**
             * Resolves all the enqueued media objects and fires all the needed callbacks
             */
            bulkResolveCommentsById: function(){
                var requestQueue = commentsQueue;
                commentsQueue = {};
                var ids = [];
                for(var id in requestQueue){
                    if(requestQueue.hasOwnProperty(id)){
                        ids.push(id);
                    }
                }
                ajax.post(
                    '/api/comment-models/',
                    {
                        'comment__in': ids
                    },
                    {
                        spinnerMessage: 'Loading comments...',
                        errorMessage: 'Failed to load comments',
                        success: function(data){
                            var items = data.payload.items;
                            items.forEach(function(item){
                                wpComments.indexComment(item);
                                var callbacks = requestQueue[item.id];
                                if(callbacks && callbacks.length) {
                                    for (var i = 0; i < callbacks.length; i++) {
                                        callbacks[i](item);
                                    }
                                }
                            });
                        }
                    }
                );
            },

            /**
             * Load post comments
             *
             * @param {int|string} postId
             * @param {int} number
             * @param {string} order 'asc'|'desc'
             * @param {function} callback
             * @param {boolean} [refresh]
             */
            getCommentsByPostId: function(postId, number, order, callback, refresh){
                if(!commentsByPostId[postId]){
                    //if(callback){
                    //    callback(commentsByPostId[postId]);
                    //}
                //}else{
                    commentsByPostId[postId] = [];
                }
                if(commentsByPostId[postId].length < number || refresh) {
                    ajax.post(
                        '/api/comment/list',
                        {
                            post_id: postId,
                            number: number,
                            status: wpComments.isCurrentUserAdmin()?'all':'approve',
                            include_unapproved: wpComments.isCurrentUserLoggedIn()?[wpComments.getCurrentUser().id]:[],
                            orderby: 'comment_ID',
                            order: order.toLowerCase() === 'asc'?'DESC':'ASC'// yeah, that's correct, and reverse upon return
                        },
                        {
                            spinnerMessage: 'Loading comments...',
                            errorMessage: 'Failed to load comments',
                            success: function (data) {
                                var items = data.payload.comments;
                                items.reverse();
                                items.forEach(function (item) {
                                    wpComments.indexComment(item);
                                });
                                if(callback){
                                    callback(items, parseInt(data.payload.total));
                                }
                            }
                        }
                    );
                }
            },

            /**
             * Load comment replies
             *
             * @param {int|string} parentId
             * @param {function} callback
             * @param {boolean} [refresh]
             */
            getCommentsByParentId: function(parentId, callback, refresh){
                var parentComment = commentsById[parentId];
                if(parentComment){
                    var needLoad = refresh;
                    var postComments = commentsByPostId[parentComment.comment_post_ID];
                    var minId = 0;
                    if(postComments && postComments.length){
                        minId = Math.min(postComments[0].id, postComments[postComments.length - 1].id);
                        if(parentId < minId){
                            needLoad = true;
                        }
                    }
                    if(!commentsByParentId[parentId]){
                        commentsByParentId[parentId]=[];
                    }
                    if(!needLoad){
                        callback(commentsByParentId[parentId]);
                    }else{
                        ajax.post(
                            '/api/comment/list',
                            {
                                post_id: parentId,
                                status: wpComments.isCurrentUserAdmin()?'all':'approve',
                                include_unapproved: wpComments.isCurrentUserLoggedIn()?[wpComments.getCurrentUser().id]:[],
                                orderby: 'comment_ID',
                                order: 'ASC'                            },
                            {
                                spinnerMessage: 'Loading comments...',
                                errorMessage: 'Failed to load comments',
                                success: function (data) {
                                    var items = data.payload.comments;
                                    items.reverse();
                                    items.forEach(function (item) {
                                        wpComments.indexComment(item);
                                    });
                                    if(callback){
                                        callback(items, parseInt(data.payload.total));
                                    }
                                }
                            }
                        );

                    }
                }

            }

        };

        return wpComments;
    }])
    .controller('comments', ['$scope', '$element', '$translate', 'ajax', 'wpComments', function($scope, $element, $translate, ajax, wpComments){
        $scope.postId = parseInt($element.attr('post-id') || $element.attr('data-post-id') || $element.data('post-id'));
        $scope.order = $element.attr('order') || $element.attr('data-order') || $element.data('order') || 'asc';

        $scope.comments = [];
        $scope.commentsById = {};
        $scope.total = 0;

        $scope.editorPopup = null;
        $scope.dialogPopup = null;

        $scope.dialog = {
            parentComment: wpComments.getEmptyComment($scope.postId),
            replies: []
        };

        $scope.editors = {
            'static': null,
            'dynamic': null
        };

        $scope.orderBy = function(){
            return $scope.order === 'asc'? '+id':'-id';
        };

        $scope.limitTo = function(){
            return $scope.order === 'asc'? -$scope.shown:$scope.shown;
        };

        /**
         * Set comments and create hash map by id
         * @param {Array} comments
         * @param {int} total
         */
        $scope.setComments = function(comments, total){
            $scope.commentsById = {};
            $scope.comments = comments || [];
            if(comments && comments.length){
                comments.forEach(function(comment){
                    $scope.commentsById[comment.id] = comment;
                });
            }
            $scope.total = total || comments.length;
        };

        /**
         * Index comment for it can be found by id
         *
         * @param comment
         */
        $scope.indexComment = function(comment){
            if($scope.commentsById[comment.id]){
                angular.extend($scope.commentsById[comment.id], comment);
            }else{
                $scope.commentsById[comment.id] = comment;
                if($scope.order === 'asc'){
                    $scope.comments.push(comment);
                }else{
                    $scope.comments.unshift(comment);
                }
            }
            $scope.total += 1;
            wpComments.indexComment(comment);
        };

        $scope.onCommentPosted = function($event, comment){
            $scope.editorPopup.hide();
            $scope.indexComment(comment);
        };

        $scope.$on('Chayka.Comments.commentUpdated', $scope.onCommentPosted);
        $scope.$on('Chayka.Comments.commentCreated', $scope.onCommentPosted);

        $scope.$on('Chayka.Comments.commentDeleted', function($event, comment){
            wpComments.removeComment(comment);
            var index = $scope.comments.indexOf(comment);
            if(index > 0){
                $scope.comments.splice(index, 1);
            }
            $scope.total -= 1;
        });

        $scope.$on('Chayka.Comments.editComment', function($event, comment){
            $scope.editors.dynamic.editComment(comment);
            $scope.editorPopup.setTitle(parseInt(comment.comment_parent)?'Edit reply':'Edit comment');
            $scope.editorPopup.show();
        });

        $scope.$on('Chayka.Comments.replyToComment', function($event, comment){
            $scope.editors.dynamic.replyToComment(comment);
            $scope.editorPopup.setTitle('Reply to comment');
            $scope.editorPopup.show();
        });

        $scope.$on('Chayka.Comments.editCanceled', function(){
            $scope.editorPopup.hide();
        });

        /**
         * Load post comments
         */
        $scope.loadComments = function(numberOfLastComments){
            wpComments.getCommentsByPostId($scope.postId, numberOfLastComments, $scope.order, function(comments, total){
                $scope.setComments(comments, total);
            });
        };

        $scope.showMore = function(more){
            $scope.loadComments($scope.comments.length+more);
        };

        $scope.$on('Chayka.Comments.dialogReplyTo', function($event, replyComment){
            wpComments.getCommentById(replyComment.comment_parent, function(parentComment){
                $scope.dialog.replies = [replyComment];
                $scope.dialog.parentComment = parentComment;
                $scope.dialogPopup.setTitle('Reply to comment');
                $scope.dialogPopup.show();
            });
        });

        $scope.$on('Chayka.Comments.dialogRepliesTo', function($event, parentComment){
            $scope.dialog.parentComment = parentComment;
        });

        $scope.closeDialog = function(){
            $scope.dialogPopup.hide();
        };

        $scope.loadComments(10);
    }])
    .directive('commentItem', ['$translate', 'avatars', 'utils', 'ajax', 'modals', 'wpComments', function($translate, avatars, utils, ajax, modals, wpComments){
        return {
            restrict: 'AE',
            scope:{
                comment: '=commentItem',
                preview: '=?'
            },
            replace: true,
            template:
            '<div class="chayka-comments-comment_item" data-ng-class="{positive_karma: comment.comment_karma > 0, negative_karma: comment.comment_karma < 0}">' +
            '   <div class="user_details">' +
            '       <span class="user_id">{{comment.user_id}}</span>' +
            '       <img class="avatar" data-ng-src="{{avatar(96)}}"/>' +
            '       <span class="name">{{comment.comment_author}}</span>' +
            '   </div>' +
            '   <div class="comment_date">{{comment.comment_date | date:\'d MMM y HH:mm:ss\'}}</div>' +
            '   <div data-spinner="spinner"></div>' +
            '   <div class="comment_voting" data-ng-hide="!!preview">' +
            '       <div class="comment_karma" data-ng-class="{positive: comment.comment_karma > 0, negative: comment.comment_karma < 0}">{{(comment.comment_karma > 0 ? "+" : "" ) + comment.comment_karma}}</div>' +
            '       <div class="comment_karma_delta" data-ng-class="{positive: comment.comment_karma_delta > 0, negative: comment.comment_karma_delta < 0}">{{(comment.comment_karma_delta > 0 ? "+" : "" ) + comment.comment_karma_delta}}</div>' +
            '       <div class="comment_vote_arrow" data-ng-class="{disabled: comment.comment_karma_delta > 0}" data-ng-click="voteUpClicked()"><span class="dashicons dashicons-before dashicons-arrow-up-alt2"></span></div>' +
            '       <div class="comment_vote_arrow" data-ng-class="{disabled: comment.comment_karma_delta < 0}" data-ng-click="voteDownClicked()"><span class="dashicons dashicons-before dashicons-arrow-down-alt2"></span></div>' +
            '   </div>' +
            '   <div class="comment_content">' +
            '       <div class="comment_reply_to" data-ng-show="!!replyTo" data-ng-click="showReplyToClicked()">@{{replyTo && replyTo.comment_author}}:</div>' +
            '       <div class="comment_message">{{comment.comment_content | limitTo : unfolded && comment.comment_content.length || maxLength}}<span data-ng-hide="unfolded || comment.comment_content.length < maxLength ">... <span class="comment_unfold" data-ng-click="unfolded = true">more</span></span></span></div>' +
            '   </div>' +
            '   <div class="comment_status">' +
            '       {{ (comment.comment_approved === 0 ? "This comment is being moderated, others do not see it" : "") | translate }}' +
            '       {{ (comment.comment_approved === "spam" ? "This comment is marked as spam, others do not see it" : "") | translate }}' +
            '   </div>' +
            '   <div class="comment_tools" data-ng-hide="!!preview">' +
            '       <span class="tool_link tool_link_reply" data-ng-show="isLoggedIn() && comment.comment_approved === 1" data-ng-click="replyClicked();"><span class="dashicons dashicons-before dashicons-admin-comments"></span> {{"Reply"|translate}}</span>' +
            '       <span class="tool_link tool_link_edit" data-ng-show="canModify()" data-ng-click="editClicked();"><span class="dashicons dashicons-before dashicons-edit"></span> {{"Edit"|translate}}</span>' +
            '       <span class="tool_link tool_link_delete" data-ng-show="canModify()" data-ng-click="deleteClicked();"><span class="dashicons dashicons-before dashicons-trash"></span> {{"Delete"|translate}}</span>' +
            '       <span class="tool_link tool_link_approve" data-ng-hide="!isAdmin() || comment.comment_approved === 1" data-ng-click="approveClicked(1);"><span class="dashicons dashicons-before dashicons-heart"></span> {{"Approve"|translate}}</span>' +
            '       <span class="tool_link tool_link_ban" data-ng-hide="!isAdmin() || comment.comment_approved === 0" data-ng-click="approveClicked(0);"><span class="dashicons dashicons-before dashicons-dismiss"></span> {{"Ban"|translate}}</span>' +
            '       <span class="tool_link tool_link_spam" data-ng-hide="!isAdmin() || comment.comment_approved === \'spam\'" data-ng-click="approveClicked(\'spam\');"><span class="dashicons dashicons-before dashicons-flag"></span> {{"SPAM"|translate}}</span>' +
            '   </div>' +
            '</div>',

            controller: function($scope, $element){
                $scope.spinner = null;
                $scope.unfolded = false;
                $scope.maxLength = 300;
                $scope.currentUser = utils.getItem(window, 'Chayka.Users.currentUser');

                $scope.isAdmin = function(){
                    return $scope.currentUser.role === 'administrator';
                };

                $scope.isLoggedIn = function(){
                    return !!parseInt($scope.currentUser.id);
                };

                $scope.canModify = function(){
                    return $scope.isAdmin() || $scope.isLoggedIn() && parseInt($scope.currentUser.id) === parseInt($scope.comment.user_id);
                };

                $scope.avatar = function(size){
                    return $scope.comment.meta && $scope.comment.meta.fb_user_id?
                        avatars.fbavatar($scope.comment.meta.fb_user_id, size):
                        avatars.gravatar($scope.comment.comment_author_email, size);
                };

                $scope.$watch('comment.comment_parent', function(value){
                    var replyToId = parseInt(value);
                    if(replyToId && (!$scope.replyTo || $scope.replyTo.id !== replyToId)){
                        wpComments.getCommentById(replyToId, function(comment){
                            $scope.replyTo = comment;
                        });
                    }
                });

                $scope.voteUpClicked = function(){
                    if($scope.comment.comment_karma_delta <= 0) {
                        ajax.post('/api/comment/vote-up', {
                            id: $scope.comment.id
                        }, {
                            spinner: $scope.spinner,
                            spinnerMessage: 'Voting up...',
                            success: function (data) {
                                angular.extend($scope.comment, data.payload);
                            }
                        });
                    }
                };

                $scope.voteDownClicked = function(){
                    if($scope.comment.comment_karma_delta >= 0) {
                        ajax.post('/api/comment/vote-down', {
                            id: $scope.comment.id
                        }, {
                            spinner: $scope.spinner,
                            spinnerMessage: 'Voting down...',
                            success: function (data) {
                                angular.extend($scope.comment, data.payload);
                            }
                        });
                    }
                };

                $scope.replyClicked = function(){
                    $scope.$emit('Chayka.Comments.replyToComment', $scope.comment);
                };

                $scope.editClicked = function(){
                    $scope.$emit('Chayka.Comments.editComment', $scope.comment);
                };

                $scope.deleteClicked = function(){
                    modals.confirm('Delete this comment?', function(){
                        ajax.del('/api/comment-model/'+$scope.comment.id,{
                            spinner: $scope.spinner,
                            spinnerMessage: 'Deleting comment...',
                            success: function(){
                                $scope.$emit('Chayka.Comments.commentDeleted', $scope.comment);
                            }
                        });
                    });
                };

                $scope.approveClicked = function(state){
                    ajax.post('/api/comment/approval', {
                        id: $scope.comment.id,
                        state: state
                    },{
                        spinner: $scope.spinner,
                        spinnerMessage: 'Setting approval state...',
                        success: function(data){
                            angular.extend($scope.comment, data.payload);
                        }
                    });

                };

                $scope.showReplyToClicked = function(){
                    $scope.$emit('Chayka.Comments.dialogReplyTo', $scope.comment);
                };
            }
        };
    }])
    .directive('commentEditor', ['$translate', 'wpComments', 'avatars', 'utils', 'ajax', function($translate, wpComments, avatars, utils, ajax){
        return {
            restrict: 'AE',
            scope:{
                editor: '=commentEditor',
                postId: '='
            },
            template:
            '<form class="chayka-comments-comment_editor" data-ng-class="{non_authorized: !isLoggedIn(), user_authorized: isLoggedIn()}" data-form-validator="validator">' +
            '   <div data-comment-item="replyToComment" data-preview="true" data-ng-show="!!replyToComment && !!replyToComment.id"></div>' +
            '   <div class="auth_invitation" data-ng-hide="isLoggedIn()">' +
            '       {{"If you"|translate}} <a href="#facebook-login"></a>' +
            '       <a href="#login">{{"log in"|translate}}</a>, {{"it\'ll be easier to leave comments!"|translate}}' +
            '   </div>' +
            '   <div class="flex_box">' +
            '       <div class="non_authorized_block" data-ng-hide="isLoggedIn()">' +
            '           <div class="form_field fullsize field_name" data-form-field="comment_author" data-check-if="!isLoggedIn()" data-check-required data-label="Your name">' +
            '               <input type="text" data-ng-model="comment.comment_author" placeholder="{{\'Your name\'|translate}}..."/>' +
            '           </div>' +
            '           <div class="form_field fullsize field_email" data-form-field="comment_author_email" data-check-if="!isLoggedIn()" data-check-required data-check-email data-label="Your email">' +
            '               <input type="text" data-ng-model="comment.comment_author_email" placeholder="{{\'Your email\'|translate}}..."/>' +
            '           </div>' +
            '           <div class="form_field fullsize field_url" data-form-field="comment_author_url" data-check-if="!isLoggedIn()" data-label="Your site url">' +
            '               <input type="text" data-ng-model="comment.comment_author_url" placeholder="{{\'Your site url\'|translate}}..."/>' +
            '           </div>' +
            '       </div>' +
            '       <div class="user_authorized_block" data-ng-show="isLoggedIn()">' +
            '           <img class="avatar" data-ng-src="{{avatar(96)}}"/>' +
            '       </div>' +
            '       <div class="content_block">' +
            '           <div class="form_field fullsize field_content" data-form-field="comment_content" data-label="Your comment" data-check-required>' +
            '               <textarea data-ng-model="comment.comment_content" placeholder="{{\'Your comment\'|translate}}..." data-auto-height></textarea>' +
            '           </div>' +
            '      </div>' +
            '   </div>' +
            '   <div class="form_box-buttons">' +
            '       <div class="required_fields_note"><span class="required_field_asterisk">*</span> - {{ "required fields" | translate}}</div>' +
            '       <button data-ng-click="saveClicked()">{{mode|translate}}</button>' +
            '       <button data-ng-click="cancelClicked()" data-ng-hide="mode===\'Publish\'">{{"Cancel"|translate}}</button>' +
            '   </div>' +
            '</form>',
            controller: function($scope, $element){

                $scope.currentUser = utils.getItem(window, 'Chayka.Users.currentUser');

                $scope.mode = 'add';

                $scope.isAdmin = function(){
                    return $scope.currentUser.role === 'administrator';
                };

                $scope.isLoggedIn = function(){
                    return !!parseInt($scope.currentUser.id);
                };

                $scope.avatar = function(size){
                    return $scope.comment.meta && $scope.currentUser.meta.fb_user_id?
                        avatars.fbavatar($scope.comment.meta.fb_user_id, size):
                        avatars.gravatar($scope.comment.comment_author_email, size);
                };

                var api = {

                    /**
                     * Set empty comment
                     */
                    initComment: function(){
                        $scope.comment = wpComments.getEmptyComment($scope.postId);
                        $scope.replyToComment = wpComments.getEmptyComment($scope.postId);
                        $scope.mode = 'Publish';
                    },

                    /**
                     * Set comment to edit
                     *
                     * @param comment
                     */
                    editComment: function(comment){
                        $scope.comment = angular.copy(comment);
                        if(parseInt(comment.comment_parent)){
                            wpComments.getCommentById(parseInt(comment.comment_parent), function(parent){
                                $scope.replyToComment = parent;
                            });
                        }else{
                            $scope.replyToComment = wpComments.getEmptyComment($scope.postId);
                        }
                        $scope.mode = 'Update';
                    },

                    /**
                     * Init comment to reply to the provided comment
                     * @param replyToComment
                     */
                    replyToComment: function(replyToComment){
                        $scope.comment = wpComments.getEmptyComment($scope.postId, parseInt(replyToComment.id));
                        $scope.replyToComment = replyToComment;
                        $scope.mode = 'Reply';
                    }
                };

                api.initComment();

                $scope.saveClicked = function(){
                    var ajaxMethod = $scope.comment.id?ajax.put:ajax.post;
                    var spinnerMessage;
                    if($scope.comment.comment_parent){
                        spinnerMessage = $scope.comment.id?
                            'Updating reply...':
                            'Posting reply...';
                    }else{
                        spinnerMessage = $scope.comment.id?
                            'Updating comment...':
                            'Posting comment...';
                    }
                    ajaxMethod('/api/comment-model', $scope.comment, {
                        formValidator: $scope.validator,
                        spinnerFieldId: 'comment_content',
                        spinnerMessage: spinnerMessage,
                        success: function(data){
                            $scope.$emit($scope.comment.id?'Chayka.Comments.commentUpdated':'Chayka.Comments.commentCreated', data.payload);
                            api.initComment();
                        }
                    });
                };

                $scope.cancelClicked = function(){
                    $scope.$emit('Chayka.Comments.editCanceled');
                    api.initComment();
                };


                $scope.editor = api;
            }
        };
    }])
;