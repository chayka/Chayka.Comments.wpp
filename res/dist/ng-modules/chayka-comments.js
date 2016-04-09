"use strict";angular.module("chayka-comments",["chayka-forms","chayka-buttons","chayka-modals","chayka-spinners","chayka-ajax","chayka-nls","chayka-utils","chayka-avatars"]).factory("wpComments",["ajax","utils",function(ajax,utils){var commentsQueue={},commentsByPostId={},commentsByParentId={},commentsById={},bulkDelay=100,commentsTimeout=null,avatarSize=48,wpComments={getCurrentUser:function(){return utils.getItem(window,"Chayka.Users.currentUser",{id:0,role:"guest"})},isCurrentUserAdmin:function(){var user=wpComments.getCurrentUser();return"administrator"===user.role},isCurrentUserLoggedIn:function(){var user=wpComments.getCurrentUser();return!!user.id},getEmptyComment:function(postId,parentCommentId){parentCommentId=parentCommentId||0;var user=wpComments.getCurrentUser(),isLoggedIn=!!parseInt(user.id),now=new Date;return{id:0,comment_post_ID:postId,comment_author:isLoggedIn?user.display_name||user.user_login:"",comment_author_email:isLoggedIn?user.user_email:"",comment_author_url:isLoggedIn?user.user_url:"",user_id:parseInt(user.id),comment_content:"",comment_karma:0,comment_karma_delta:0,comment_approved:0,comment_parent:parentCommentId,comment_type:"",comment_date:now.toString(),comment_date_gmt:now.toString(),meta:{fb_user_id:utils.getItem(user,"meta.fb_user_id",0)}}},indexComment:function(comment,indexPostId,indexParentId){if(commentsById[comment.id])angular.extend(commentsById[comment.id],comment);else{commentsById[comment.id]=comment,indexPostId&&commentsByPostId[comment.comment_post_ID]&&commentsByPostId[comment.comment_post_ID].push(comment);var parentId=comment.comment_parent;if(indexParentId&&parentId){commentsByParentId[parentId]||(commentsByParentId[parentId]=[]),commentsByParentId[parentId].push(comment);var parent=commentsById[parentId];parent&&(parent.total_replies=commentsByParentId[parentId].length)}}comment.total_replies=commentsByParentId[comment.id]?commentsByParentId[comment.id].length:0},removeComment:function(comment){for(var id in commentsById)commentsById.hasOwnProperty(id)&&commentsById[id]&&commentsById[id].comment_parent===comment.id&&(commentsById[id].comment_parent=comment.comment_parent);var index;commentsByPostId[comment.comment_post_ID]&&(index=commentsByPostId[comment.comment_post_ID].indexOf(comment),index>=0&&commentsByPostId[comment.comment_post_ID].splice(index,1)),comment.comment_parent&&commentsByParentId[comment.comment_parent]&&(index=commentsByParentId[comment.comment_parent].indexOf(comment),index>=0&&commentsByParentId[comment.comment_parent].splice(index,1)),commentsById[comment.id]=null},getCommentById:function(id,callback,delay){return commentsById[id]?void callback(commentsById[id]):(commentsQueue[id]||(commentsQueue[id]=[]),commentsQueue[id].push(callback),commentsTimeout&&clearTimeout(commentsTimeout),void(commentsTimeout=setTimeout(wpComments.bulkResolveCommentsById,delay||bulkDelay)))},bulkResolveCommentsById:function(){var requestQueue=commentsQueue;commentsQueue={};var ids=[];for(var id in requestQueue)requestQueue.hasOwnProperty(id)&&ids.push(id);ajax.post("/api/comment-models/",{comment__in:ids},{spinnerMessage:"Loading comments...",errorMessage:"Failed to load comments",success:function(data){var items=data.payload.items;items.forEach(function(item){wpComments.indexComment(item,!1,!1);var callbacks=requestQueue[item.id];if(callbacks&&callbacks.length)for(var i=0;i<callbacks.length;i++)callbacks[i](item)})}})},getCommentsByPostId:function(postId,number,order,callback,refresh){commentsByPostId[postId]||(commentsByPostId[postId]=[]),(commentsByPostId[postId].length<number||refresh)&&ajax.post("/api/comment/list",{post_id:postId,number:number,status:wpComments.isCurrentUserAdmin()?"all":"approve",include_unapproved:wpComments.isCurrentUserLoggedIn()?[wpComments.getCurrentUser().id]:[],orderby:"comment_ID",order:"DESC"},{spinnerMessage:"Loading comments...",errorMessage:"Failed to load comments",success:function(data){var items=data.payload.comments;"asc"===order.toLowerCase()&&items.reverse(),items.forEach(function(item){wpComments.indexComment(item,!0,!0)}),callback&&callback(items,parseInt(data.payload.total))}})},getCommentsByParentId:function(parentId,callback,refresh){var parentComment=commentsById[parentId];if(parentComment){var postComments=commentsByPostId[parentComment.comment_post_ID],minId=0;postComments&&postComments.length&&(minId=Math.min(postComments[0].id,postComments[postComments.length-1].id),minId>parentId&&(refresh=!0)),commentsByParentId[parentId]||(commentsByParentId[parentId]=[]),refresh?ajax.post("/api/comment/list",{post_id:parentId,status:wpComments.isCurrentUserAdmin()?"all":"approve",parent:parentId,include_unapproved:wpComments.isCurrentUserLoggedIn()?[wpComments.getCurrentUser().id]:[],orderby:"comment_ID",order:"ASC"},{spinnerMessage:"Loading replies...",errorMessage:"Failed to load replies",success:function(data){var items=data.payload.comments;items.forEach(function(item){wpComments.indexComment(item,!1,!0)}),callback&&callback(items)}}):callback(commentsByParentId[parentId])}},flush:function(){commentsById={},commentsByParentId={},commentsByPostId={}},setAvatarSize:function(size){avatarSize=size},getAvatarSize:function(){return avatarSize}};return wpComments}]).controller("comments",["$scope","$element","nls","ajax","utils","wpComments",function($scope,$element,nls,ajax,utils,wpComments){var getVar=function(name,defaultValue){return utils.getHtmlParam($element,name,defaultValue)};$scope.postId=parseInt(getVar("post-id",0)),$scope.order=getVar("order","asc"),$scope.perPage=parseInt(getVar("per-page",50)),$scope.requireNameEmail=!!getVar("require-name-email",!0),$scope.requireAuth=!!getVar("require-auth",!1),$scope.readOnly=!!getVar("read-only",!1),wpComments.setAvatarSize(parseInt(getVar("avatar-size",48))),$scope.comments=[],$scope.commentsById={},$scope.total=0,$scope.editorPopup=null,$scope.dialogPopup=null,$scope.dialog={mode:"reply",parentComment:wpComments.getEmptyComment($scope.postId),replies:[]},$scope.editors={"static":null,dynamic:null},$scope.setComments=function(comments,total){$scope.commentsById={},$scope.comments=comments||[],comments&&comments.length&&comments.forEach(function(comment){$scope.commentsById[comment.id]=comment}),$scope.total=total||comments.length},$scope.indexComment=function(comment){$scope.commentsById[comment.id]?angular.extend($scope.commentsById[comment.id],comment):$scope.commentsById[comment.id]=comment,wpComments.indexComment(comment,!0,!0)},$scope.onCommentCreated=function($event,comment){$scope.editorPopup.hide(),$scope.indexComment(comment),"asc"===$scope.order?$scope.comments.push(comment):$scope.comments.unshift(comment),$scope.total+=1},$scope.onCommentUpdated=function($event,comment){$scope.editorPopup.hide(),$scope.indexComment(comment)},$scope.$on("Chayka.Comments.commentUpdated",$scope.onCommentUpdated),$scope.$on("Chayka.Comments.commentCreated",$scope.onCommentCreated),$scope.$on("Chayka.Comments.commentDeleted",function($event,comment){var index=$scope.comments.indexOf(comment);index>=0&&$scope.comments.splice(index,1),$scope.total-=1}),$scope.$on("Chayka.Comments.editComment",function($event,comment){$scope.dialogPopup.hide(),$scope.editors.dynamic.editComment(comment),$scope.editorPopup.setTitle(parseInt(comment.comment_parent)?"Edit reply":"Edit comment"),$scope.editorPopup.show()}),$scope.$on("Chayka.Comments.replyToComment",function($event,comment){$scope.dialogPopup.hide(),$scope.editors.dynamic.replyToComment(comment),$scope.editorPopup.setTitle("Reply to comment"),$scope.editorPopup.show()}),$scope.$on("Chayka.Comments.editCanceled",function(){$scope.editorPopup.hide()}),$scope.loadComments=function(numberOfLastComments){wpComments.getCommentsByPostId($scope.postId,numberOfLastComments,$scope.order,function(comments,total){$scope.setComments(comments,total)})},$scope.showMore=function(more){$scope.loadComments($scope.comments.length+more)},$scope.$on("Chayka.Comments.dialogReplyTo",function($event,replyComment){wpComments.getCommentById(replyComment.comment_parent,function(parentComment){$scope.editorPopup.hide(),$scope.dialog.replies=[replyComment],$scope.dialog.parentComment=parentComment,$scope.dialog.mode="reply",$scope.dialogPopup.setTitle("Reply to comment"),$scope.dialogPopup.show()})}),$scope.$on("Chayka.Comments.dialogRepliesTo",function($event,parentComment){wpComments.getCommentsByParentId(parentComment.id,function(replies){$scope.editorPopup.hide(),$scope.dialog.parentComment=parentComment,$scope.dialog.replies=replies,$scope.dialog.mode="replies",$scope.dialogPopup.setTitle("Replies to comment"),$scope.dialogPopup.show()})}),$scope.closeDialog=function(){$scope.dialogPopup.hide()};var preload=getVar("import");if(preload){var preloadContainer=utils.getItem(window,preload);(preloadContainer.comments||[]).forEach(function(comment){wpComments.indexComment(comment,!0,!0)}),$scope.setComments(preloadContainer.comments,preloadContainer.total)}else $scope.loadComments($scope.perPage)}]).directive("commentItem",["nls","avatars","utils","ajax","modals","wpComments",function(nls,avatars,utils,ajax,modals,wpComments){return{restrict:"AE",scope:{comment:"=commentItem",preview:"=?"},replace:!0,template:'<div class="chayka-comments-comment_item chayka-comments-width" data-ng-class="{positive_karma: comment.comment_karma > 0, negative_karma: comment.comment_karma < 0, unapproved: comment.comment_approved === 0, spam: comment.comment_approved === \'spam\', approved: comment.comment_approved === 1}">   <div class="user_details">       <span class="user_id">{{comment.user_id}}</span>       <img class="avatar" data-ng-src="{{avatar()}}" data-ng-srcset="{{avatar(2)}} 2x"/>       <span class="name">{{comment.comment_author || \'Guest\' | nls }}</span>   </div>   <div class="comment_date">{{comment.comment_date | date:\'d MMM y HH:mm:ss\' | nls}}</div>   <div class="comment_voting" data-ng-hide="!!preview">       <div class="comment_karma" data-ng-class="{positive: comment.comment_karma > 0, negative: comment.comment_karma < 0}">{{(comment.comment_karma > 0 ? "+" : "" ) + comment.comment_karma}}</div>       <div class="comment_karma_delta" data-ng-class="{positive: comment.comment_karma_delta > 0, negative: comment.comment_karma_delta < 0}">{{(comment.comment_karma_delta > 0 ? "+" : "" ) + comment.comment_karma_delta}}</div>       <div class="comment_vote_arrow vote_up" data-ng-class="{disabled: comment.comment_karma_delta > 0}" data-ng-click="voteUpClicked()"><span class="dashicons dashicons-before dashicons-arrow-up-alt2"></span></div>       <div class="comment_vote_arrow vote_down" data-ng-class="{disabled: comment.comment_karma_delta < 0}" data-ng-click="voteDownClicked()"><span class="dashicons dashicons-before dashicons-arrow-down-alt2"></span></div>   </div>   <div data-spinner="spinner"></div>   <div class="comment_content">       <div class="comment_reply_to chayka-comments-link" data-ng-show="!!replyTo" data-ng-click="showReplyToClicked()">@{{replyTo && replyTo.comment_author}}:</div>       <div class="comment_message">{{comment.comment_content | limitTo : unfolded && comment.comment_content.length || maxLength}}<span data-ng-hide="unfolded || comment.comment_content.length < maxLength ">... <span class="comment_unfold" data-ng-click="unfolded = true">more</span></span></span></div>       <div class="comment_total_replies chayka-comments-link" data-ng-show="!!comment.total_replies" data-ng-click="showRepliesClicked()">{{"Replies"|nls}}: {{comment.total_replies}}</div>   </div>   <div class="comment_status" data-ng-hide="comment.comment_approved === 1">       {{ (comment.comment_approved === 0 ? "This comment is being moderated, others do not see it" : "") | nls }}       {{ (comment.comment_approved === "spam" ? "This comment is marked as spam, others do not see it" : "") | nls }}   </div>   <div class="comment_tools" data-ng-hide="!!preview">       <span class="tool_link tool_link_reply" data-ng-show="isLoggedIn() && comment.comment_approved === 1 && commentsOpen()" data-ng-click="replyClicked();"><span class="dashicons dashicons-before dashicons-admin-comments"></span> {{"Reply"|nls}}</span>       <span class="tool_link tool_link_edit" data-ng-show="canModify()" data-ng-click="editClicked();"><span class="dashicons dashicons-before dashicons-edit"></span> {{"Edit"|nls}}</span>       <span class="tool_link tool_link_delete" data-ng-show="canModify()" data-ng-click="deleteClicked();"><span class="dashicons dashicons-before dashicons-trash"></span> {{"Delete"|nls}}</span>       <span class="tool_link tool_link_approve" data-ng-hide="!isAdmin() || comment.comment_approved === 1" data-ng-click="approveClicked(1);"><span class="dashicons dashicons-before dashicons-heart"></span> {{"Approve"|nls}}</span>       <span class="tool_link tool_link_ban" data-ng-hide="!isAdmin() || comment.comment_approved === 0 || !!comment.total_replies" data-ng-click="approveClicked(0);"><span class="dashicons dashicons-before dashicons-dismiss"></span> {{"Ban"|nls}}</span>       <span class="tool_link tool_link_spam" data-ng-hide="!isAdmin() || comment.comment_approved === \'spam\' || !!comment.total_replies" data-ng-click="approveClicked(\'spam\');"><span class="dashicons dashicons-before dashicons-flag"></span> {{"SPAM"|nls}}</span>   </div></div>',controller:function($scope){$scope.spinner=null,$scope.unfolded=!1,$scope.maxLength=300,$scope.currentUser=utils.getItem(window,"Chayka.Users.currentUser"),$scope.isAdmin=function(){return"administrator"===$scope.currentUser.role},$scope.isLoggedIn=function(){return!!parseInt($scope.currentUser.id)},$scope.canModify=function(){return $scope.isAdmin()||$scope.isLoggedIn()&&parseInt($scope.currentUser.id)===parseInt($scope.comment.user_id)},$scope.commentsOpen=function(){return"open"===window.Chayka.Posts.postsById[$scope.comment.comment_post_ID].comment_status},$scope.avatar=function(multiplier){multiplier=multiplier||1;var size=wpComments.getAvatarSize()*multiplier;return $scope.comment.meta&&$scope.comment.meta.fb_user_id?avatars.fbavatar($scope.comment.meta.fb_user_id,size):avatars.gravatar($scope.comment.comment_author_email,size)},$scope.$watch("comment.comment_parent",function(value){var replyToId=parseInt(value);!replyToId||$scope.replyTo&&$scope.replyTo.id===replyToId||wpComments.getCommentById(replyToId,function(comment){$scope.replyTo=comment})}),$scope.voteUpClicked=function(){$scope.comment.comment_karma_delta<=0&&ajax.post("/api/comment/vote-up",{id:$scope.comment.id},{spinner:$scope.spinner,spinnerMessage:"Voting up...",success:function(data){angular.extend($scope.comment,data.payload)}})},$scope.voteDownClicked=function(){$scope.comment.comment_karma_delta>=0&&ajax.post("/api/comment/vote-down",{id:$scope.comment.id},{spinner:$scope.spinner,spinnerMessage:"Voting down...",success:function(data){angular.extend($scope.comment,data.payload)}})},$scope.replyClicked=function(){$scope.$emit("Chayka.Comments.replyToComment",$scope.comment)},$scope.editClicked=function(){$scope.$emit("Chayka.Comments.editComment",$scope.comment)},$scope.deleteClicked=function(){modals.confirm("Delete this comment?",function(){ajax.del("/api/comment-model/"+$scope.comment.id,{spinner:$scope.spinner,spinnerMessage:"Deleting comment...",success:function(){$scope.$emit("Chayka.Comments.commentDeleted",$scope.comment)}})})},$scope.approveClicked=function(state){ajax.post("/api/comment/approval",{id:$scope.comment.id,state:state},{spinner:$scope.spinner,spinnerMessage:"Setting approval state...",success:function(data){angular.extend($scope.comment,data.payload)}})},$scope.showReplyToClicked=function(){$scope.$emit("Chayka.Comments.dialogReplyTo",$scope.comment)},$scope.showRepliesClicked=function(){$scope.$emit("Chayka.Comments.dialogRepliesTo",$scope.comment)}}}}]).directive("commentEditor",["nls","wpComments","avatars","utils","ajax",function(nls,wpComments,avatars,utils,ajax){return{restrict:"AE",scope:{editor:"=commentEditor",postId:"=",requireNameEmail:"=",requireAuth:"=?"},template:'<form class="chayka-comments-comment_editor chayka-comments-width" data-ng-class="{non_authorized: !isLoggedIn(), user_authorized: isLoggedIn()}" data-form-validator="validator">   <div class="reply_to_box" data-ng-show="!!replyToComment && !!replyToComment.id">       <h3>{{"Comment"|nls}}:</h3>       <div data-comment-item="replyToComment" data-preview="true"></div>       <h3>{{"Reply"|nls}}:</h3>   </div>   <div class="auth_required" data-ng-show="requireAuth && !isLoggedIn()">       {{ "Only authenticated users can leave comments" | nls}}.<br/>       {{"You need to" | nls }} <a href="/wp-login.php?action=register">{{"join"|nls}}</a> {{"and then" | nls }} <a href="/wp-login.php">{{"log in"|nls}}</a>       <div class="social_auth" data-ng-show="canAuthViaFacebook() || canAuthViaLinkedIn()">           <div class="social_or">{{"or"|nls}}</div> {{"you can log in via social network"|nls}}:           <div class="auth_button auth_button_facebook" data-ng-show="canAuthViaFacebook()" data-auth-facebook-button>facebook</div>           <div class="auth_button auth_button_linkedin"  data-ng-show="canAuthViaLinkedIn()" data-auth-linkedin-button>linkedin</div>       </div>   </div>   <div class="auth_invitation" data-ng-hide="isLoggedIn() || requireAuth">       {{"If you"|nls}}        <span class="auth_button auth_button_facebook" data-ng-show="canAuthViaFacebook()" data-auth-facebook-button></span>       <span class="auth_button auth_button_linkedin"  data-ng-show="canAuthViaLinkedIn()" data-auth-linkedin-button></span>       <a href="/wp-login.php">{{"log in"|nls}}</a>, {{"it\'ll be easier to leave comments!"|nls}}   </div>   <div class="flex_box" data-ng-hide="requireAuth && !isLoggedIn()">       <div class="non_authorized_block" data-ng-hide="isLoggedIn()" data-ng-class="{require_name_email: requireNameEmail}">           <div class="form_field fullsize field_name" data-form-field="comment_author" data-check-if="!isLoggedIn()" data-check-required data-check-required-if="requireNameEmail" data-label="Your name">               <input type="text" data-ng-model="comment.comment_author" placeholder="{{\'Your name\'|nls}}..."/>           </div>           <div class="form_field fullsize field_email" data-form-field="comment_author_email" data-check-if="!isLoggedIn()" data-check-required data-check-required-if="requireNameEmail" data-check-email data-label="Your email">               <input type="text" data-ng-model="comment.comment_author_email" placeholder="{{\'Your email\'|nls}}..."/>           </div>           <div class="form_field fullsize field_url" data-form-field="comment_author_url" data-check-if="!isLoggedIn()" data-label="Your site url">               <input type="text" data-ng-model="comment.comment_author_url" placeholder="{{\'Your site url\'|nls}}..."/>           </div>       </div>       <div class="user_authorized_block" data-ng-show="isLoggedIn()">           <img class="avatar" data-ng-src="{{avatar()}}" data-ng-srcset="{{avatar(2)}} 2x"/>       </div>       <div class="content_block">           <div class="form_field fullsize field_content" data-form-field="comment_content" data-label="Your comment" data-check-required>               <textarea data-ng-model="comment.comment_content" placeholder="{{\'Your comment\'|nls}}..." data-auto-height></textarea>           </div>      </div>   </div>   <div class="form_box-buttons" data-ng-hide="requireAuth && !isLoggedIn()">       <div class="required_fields_note" data-ng-show="requireNameEmail"><span class="required_field_asterisk">*</span> - {{ "required fields" | nls}}</div>       <button data-ng-click="cancelClicked()" data-ng-hide="mode===\'Publish\'">{{"Cancel"|nls}}</button>       <button data-ng-click="saveClicked()">{{mode|nls}}</button>   </div></form>',controller:function($scope){$scope.currentUser=utils.getItem(window,"Chayka.Users.currentUser"),$scope.mode="add",$scope.isAdmin=function(){return"administrator"===$scope.currentUser.role},$scope.isLoggedIn=function(){return!!parseInt($scope.currentUser.id)},$scope.avatar=function(multiplier){multiplier=multiplier||1;var size=wpComments.getAvatarSize()*multiplier;return $scope.comment.meta&&$scope.comment.meta.fb_user_id?avatars.fbavatar($scope.comment.meta.fb_user_id,size):avatars.gravatar($scope.comment.comment_author_email,size)},$scope.canAuthViaFacebook=function(){return!!utils.getItem(window,"Chayka.Auth.Facebook")},$scope.canAuthViaLinkedIn=function(){return!!utils.getItem(window,"Chayka.Auth.LinkedIn")};var api={initComment:function(){$scope.comment=wpComments.getEmptyComment($scope.postId),$scope.replyToComment=wpComments.getEmptyComment($scope.postId),$scope.mode="Publish"},editComment:function(comment){$scope.comment=angular.copy(comment),parseInt(comment.comment_parent)?wpComments.getCommentById(parseInt(comment.comment_parent),function(parent){$scope.replyToComment=parent}):$scope.replyToComment=wpComments.getEmptyComment($scope.postId),$scope.mode="Update"},replyToComment:function(replyToComment){$scope.comment=wpComments.getEmptyComment($scope.postId,parseInt(replyToComment.id)),$scope.replyToComment=replyToComment,$scope.mode="Reply"}};api.initComment(),$scope.saveClicked=function(){var spinnerMessage,ajaxMethod=$scope.comment.id?ajax.put:ajax.post;spinnerMessage=$scope.comment.comment_parent?$scope.comment.id?"Updating reply...":"Posting reply...":$scope.comment.id?"Updating comment...":"Posting comment...",$scope.validator.validateFields()&&ajaxMethod("/api/comment-model",$scope.comment,{formValidator:$scope.validator,spinnerFieldId:"comment_content",validateOnSend:!1,spinnerMessage:spinnerMessage,success:function(data){$scope.$emit($scope.comment.id?"Chayka.Comments.commentUpdated":"Chayka.Comments.commentCreated",data.payload),api.initComment()}})},$scope.cancelClicked=function(){$scope.$emit("Chayka.Comments.editCanceled"),api.initComment()},$scope.editor=api}}}]);