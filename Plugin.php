<?php

namespace Chayka\Comments;

use Chayka\WP;

class Plugin extends WP\Plugin{

    /* chayka: constants */
    
    public static $instance = null;

    public static function init(){
        if(!static::$instance){
            static::$instance = $app = new self(__FILE__, array(
	            'comment'
                /* chayka: init-controllers */
            ));
            $app->dbUpdate(array());
	        $app->addSupport_UriProcessing();
	        $app->addSupport_ConsolePages();
	        $app->addSupport_Metaboxes();


            /* chayka: init-addSupport */
        }
    }


    /**
     * Register your action hooks here using $this->addAction();
     */
    public function registerActions() {
    	/* chayka: registerActions */
    }

    /**
     * Register your action hooks here using $this->addFilter();
     */
    public function registerFilters() {
		/* chayka: registerFilters */
	    $this->addFilter('comments_template', 'getCommentsTemplateFile', 10, 0);
    }

	/**
	 * Inject our custom comments template
	 * @return string
	 */
	public function getCommentsTemplateFile(){
		return Plugin::getBasePath().'/comments.php';
	}

    /**
     * Register scripts and styles here using $this->registerScript() and $this->registerStyle()
     *
     * @param bool $minimize
     */
    public function registerResources($minimize = false) {
        $this->registerBowerResources(true);

        $this->setResSrcDir('src/');
        $this->setResDistDir('dist/');

	    $this->registerNgScript('chayka-comments', 'ng-modules/chayka-comments.js', ['chayka-modals', 'chayka-ajax', 'chayka-spinners', 'chayka-forms', 'chayka-avatars', 'chayka-buttons', 'chayka-utils']);
		$this->registerStyle('chayka-comments', 'ng-modules/chayka-comments.css', ['chayka-modals', 'chayka-spinners', 'chayka-forms', 'dashicons']);

		/* chayka: registerResources */
    }

    /**
     * Routes are to be added here via $this->addRoute();
     */
    public function registerRoutes() {
        $this->addRoute('default');
    }

    /**
     * Registering console pages
     */
    public function registerConsolePages(){
        $this->addConsoleSubPage('edit-comments.php', 'Comments', 'update_core', 'comments', '/admin/comments');

        /* chayka: registerConsolePages */
    }
    
    /**
     * Add custom metaboxes here via addMetaBox() calls;
     */
    public function registerMetaBoxes(){
        /* chayka: registerMetaBoxes */
    }

    /**
     * Remove registered metaboxes here via removeMetaBox() calls;
     */
    public function unregisterMetaBoxes(){
        /* chayka: unregisterMetaBoxes */
    }
}