<?php

namespace Chayka\Comments;

use Chayka\Helpers\Util;
use Chayka\WP\Helpers\AclHelper;
use Chayka\WP\Models\CommentModel;
use Chayka\WP\MVC\Controller;
use Chayka\Helpers\InputHelper;
use Chayka\WP\Helpers\JsonHelper;
use Chayka\WP\Queries\CommentQuery;

class CommentController extends Controller{

    public function init(){
        // NlsHelper::load('main');
         InputHelper::captureInput();
    }

	public function listAction(){
		$params = InputHelper::getParams(true);
		$params = array_intersect_key($params, array(
			'post_id'=>true,
			'status'=>true,
			'orderby'=>true,
			'order'=>true,
			'number'=>true,
			'include_unapproved'=>true,
			'parent'=>true,
		));
		if(!AclHelper::isAdmin()){
			$params['status'] = 'approve';
		}
		$query = CommentQuery::query()->setVars($params);
		$comments = $query->select();
		$total = count($comments);
		if(isset($params['number'])){
			$total = $query->selectCount();
		}
		$users = array();
		foreach($comments as $comment){
			/**
			 * @var CommentModel $comment
			 */
			if($comment->getUserId()){
				$users[$comment->getUserId()] = $comment->getUser();
			}
		}
		$payload = array(
			'comments'=>$comments,
			'total'=>$total,
			'users'=>$users,
		);
		JsonHelper::respond($payload);
	}

	public function voteUpAction(){
		Util::sessionStart();
		$commentId = InputHelper::getParam('id', 0);
		$comment = CommentModel::selectById($commentId, false);
		$comment->voteUp();
		session_commit();
		JsonHelper::respond($comment);
	}

	public function voteDownAction(){
		Util::sessionStart();
		$commentId = InputHelper::getParam('id', 0);
		$comment = CommentModel::selectById($commentId, false);
		$comment->voteDown();
		session_commit();
		JsonHelper::respond($comment);
	}

	public function approvalAction(){
		AclHelper::apiPermissionRequired('moderate_comments');
		$commentId = InputHelper::getParam('id', 0);
		$state = InputHelper::getParam('state', 0);
		if($state != 1){
			$children = CommentModel::query()->parent($commentId)->selectCount();
			if($children){
				JsonHelper::respondError('Comment already has replies');
			}
		}
		$comment = CommentModel::selectById($commentId, false);
		$comment->setIsApproved($state);
		$comment->update();
		JsonHelper::respond($comment);
	}
} 