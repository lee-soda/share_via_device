<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\ShareViaDevice\Listener;

use OCA\Files\Event\LoadAdditionalScriptsEvent;
use OCA\ShareViaDevice\AppInfo\Application;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\Util;

/** @template-implements IEventListener<LoadAdditionalScriptsEvent> */
final class LoadFilesScriptListener implements IEventListener {
	public function handle(Event $event): void {
		if (!$event instanceof LoadAdditionalScriptsEvent) {
			return;
		}

		Util::addStyle(Application::APP_ID, 'share-via-device-share_via_device');
		Util::addScript(Application::APP_ID, 'share-via-device-main');
	}
}
