<?php
/**
 * Plugin Name: Chayka.Comments
 * Plugin URI: git@github.com:chayka/Chayka.Comments.wpp.git
 * Description: WordPress comments plugin built on Chayka framework
 * Version: 0.0.1
 * Author: Boris Mossounov <borix@tut.by>
 * Author URI: http://anotherguru.me/
 * License: proprietary
 */

require_once __DIR__.'/vendor/autoload.php';

if(!class_exists('Chayka\WP\Plugin')){
    add_action( 'admin_notices', function () {
?>
    <div class="error">
        <p>Chayka.Core plugin is required in order for Chayka.Comments to work properly</p>
    </div>
<?php
	});
}else{
	add_action('init', array('Chayka\Comments\Plugin', 'init'));
}
