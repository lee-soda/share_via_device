<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

return [
	'routes' => [
		[
			'name' => 'share#create',
			'url' => '/api/v1/shares',
			'verb' => 'POST',
		],
		[
			'name' => 'share#delete',
			'url' => '/api/v1/shares',
			'verb' => 'DELETE',
		],
	],
];
