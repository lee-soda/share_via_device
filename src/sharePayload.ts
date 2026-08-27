/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CreatedShare } from './types.ts'
import { t } from '@nextcloud/l10n'

export interface PreparedSharePayload {
	data: ShareData
	copyText: string
}

export function prepareSharePayload(shares: readonly CreatedShare[]): PreparedSharePayload {
	if (shares.length === 0) {
		throw new Error('At least one public link is required')
	}

	const copyText = shares
		.map(({ name, url }) => `${name}: ${url}`)
		.join('\n')

	if (shares.length === 1) {
		const share = shares[0]!
		return {
			copyText,
			data: {
				title: share.name,
				text: t('share_via_device', 'Shared from Nextcloud'),
				url: share.url,
			},
		}
	}

	return {
		copyText,
		data: {
			title: t('share_via_device', 'Nextcloud public links'),
			text: copyText,
		},
	}
}
