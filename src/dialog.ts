/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { PreparedSharePayload } from './sharePayload.ts'
import type { ShareAttemptResult } from './types.ts'
import { getDialogBuilder, showError, showSuccess, showWarning } from '@nextcloud/dialogs'
import { t } from '@nextcloud/l10n'
import ContentCopySvg from '@mdi/svg/svg/content-copy.svg?raw'
import ShareVariantSvg from '@mdi/svg/svg/share-variant.svg?raw'
import { copyToClipboard, shareWithSystem, supportsSystemShare } from './webShare.ts'

type DialogResult = 'success' | 'cancelled' | 'retry-copy'

async function showOptions(payload: PreparedSharePayload, allowSystemShare: boolean): Promise<DialogResult> {
	let operation: Promise<DialogResult> | null = null
	const builder = getDialogBuilder(t('share_via_device', 'Share via device'))
		.setText(allowSystemShare
			? t('share_via_device', 'The public links are ready. Open the device share sheet or copy all links.')
			: t('share_via_device', 'The device share sheet is unavailable. You can copy all public links instead.'))
		.addButton({
			label: t('share_via_device', 'Cancel'),
			variant: 'tertiary',
			callback: () => {
				operation = Promise.resolve('cancelled')
			},
		})
		.addButton({
			label: t('share_via_device', 'Copy links'),
			icon: ContentCopySvg,
			variant: allowSystemShare ? 'secondary' : 'primary',
			callback: () => {
				operation = copyToClipboard(payload.copyText).then((copied) => {
					if (copied) {
						showSuccess(t('share_via_device', 'Public links copied.'))
						return 'success'
					}
					showError(t('share_via_device', 'The links could not be copied.'))
					return 'cancelled'
				})
			},
		})

	if (allowSystemShare) {
		builder.addButton({
			label: t('share_via_device', 'Share'),
			icon: ShareVariantSvg,
			variant: 'primary',
			callback: () => {
				operation = shareWithSystem(payload.data).then((result): DialogResult => {
					if (result === 'success') {
						return 'success'
					}
					if (result === 'cancelled') {
						return 'cancelled'
					}
					return 'retry-copy'
				})
			},
		})
	}

	try {
		await builder.build().show()
	} catch {
		return 'cancelled'
	}

	return operation === null ? 'cancelled' : operation
}

export async function presentShareOptions(payload: PreparedSharePayload): Promise<ShareAttemptResult> {
	const canShare = supportsSystemShare(payload.data)
	const firstResult = await showOptions(payload, canShare)
	if (firstResult === 'success' || firstResult === 'cancelled') {
		return firstResult
	}

	showWarning(t('share_via_device', 'The device share sheet could not be opened. Copy the links instead.'))
	const copyResult = await showOptions(payload, false)
	return copyResult === 'success' ? 'success' : 'cancelled'
}
