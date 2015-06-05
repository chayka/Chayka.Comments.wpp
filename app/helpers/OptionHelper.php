<?php

namespace Chayka\Comments;

use Chayka\WP\Helpers;

class OptionHelper extends Helpers\OptionHelper{

	/**
	 * Get option prefix.
	 * Since we try to work with standard WP settings, we don't need no prefix.
	 *
	 * @return string
	 */
	public static function getPrefix(){
		return '';
	}
} 