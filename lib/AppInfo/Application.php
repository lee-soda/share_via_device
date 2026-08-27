<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\ShareViaDevice\AppInfo;

use OCA\Files\Event\LoadAdditionalScriptsEvent;
use OCA\ShareViaDevice\Listener\LoadFilesScriptListener;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;

final class Application extends App implements IBootstrap {
	public const APP_ID = 'share_via_device';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
		$context->registerEventListener(
			LoadAdditionalScriptsEvent::class,
			LoadFilesScriptListener::class,
		);
	}

	public function boot(IBootContext $context): void {
	}
}
