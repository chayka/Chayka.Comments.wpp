<?php

namespace Chayka\Comments;

use Chayka\Email;

class EmailHelper extends Email\EmailHelper{

    /**
     * @return \Chayka\MVC\View
     */
    public static function getView(){
        $view = Plugin::getView();
        return $view;
    }

    // /**
    //  * Send dummy message
    //  * @param string $dummy
    //  */
    // public static function sendDummy($dummy){
    //     self::sendTemplate('Sending a dummy', 'email/dummy.phtml', array(
    //         'dummy' => $dummy
    //     ), 'to@example.com', 'from@example.com');
    // }
}