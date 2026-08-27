/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { IFileAction, INode } from '@nextcloud/files'
import type { FlowResult } from './types.ts'
import { getCapabilities } from '@nextcloud/capabilities'
import { showError, showInfo, showLoading, showWarning } from '@nextcloud/dialogs'
import { Permission, registerFileAction } from '@nextcloud/files'
import { t } from '@nextcloud/l10n'
import ShareVariantSvg from '@mdi/svg/svg/share-variant.svg?raw'
import '@nextcloud/dialogs/style.css'
import { createPublicLinks, deletePublicLinks, ShareApiError } from './api.ts'
import { presentShareOptions } from './dialog.ts'
import { prepareSharePayload } from './sharePayload.ts'
import { hasTransientActivation, shareWithSystem, supportsSystemShare } from './webShare.ts'

interface SharingCapabilities {
	files_sharing?: {
		api_enabled?: boolean
		public?: {
			enabled?: boolean
			password?: {
				enforced?: boolean
			}
		}
	}
}

function sharingCapabilities(): SharingCapabilities['files_sharing'] {
	return (getCapabilities() as SharingCapabilities).files_sharing
}

function canOfferAction(nodes: readonly INode[]): boolean {
	const capabilities = sharingCapabilities()
	return nodes.length > 0
		&& capabilities?.api_enabled === true
		&& capabilities.public?.enabled === true
		&& nodes.every((node) => node.root.startsWith('/files/'))
		&& nodes.every((node) => (node.permissions & Permission.SHARE) === Permission.SHARE)
}

async function cleanup(shares: readonly { id: string }[]): Promise<boolean> {
	return deletePublicLinks(shares.map(({ id }) => id))
}

export async function runShareFlow(nodes: readonly INode[]): Promise<FlowResult> {
	if (sharingCapabilities()?.public?.password?.enforced === true) {
		showWarning(t(
			'share_via_device',
			'Your server requires passwords for public links. Open Nextcloud’s standard Share panel for the selected item.',
		))
		return 'cancelled'
	}

	const paths = [...new Set(nodes.map(({ path }) => path))]
	const loading = showLoading(t(
		'share_via_device',
		'Creating fresh public links for {count} items …',
		{ count: paths.length },
	), { timeout: -1 })

	try {
		const shares = await createPublicLinks(paths)
		loading?.hideToast()
		const payload = prepareSharePayload(shares)

		if (supportsSystemShare(payload.data) && hasTransientActivation()) {
			const immediateResult = await shareWithSystem(payload.data)
			if (immediateResult === 'success') {
				return 'success'
			}
			if (immediateResult === 'cancelled') {
				const cleanupComplete = await cleanup(shares)
				if (!cleanupComplete) {
					showError(t('share_via_device', 'Sharing was cancelled, but cleanup may be incomplete. Check Nextcloud’s standard Share panel.'))
				}
				return 'cancelled'
			}
		}

		const dialogResult = await presentShareOptions(payload)
		if (dialogResult === 'success') {
			return 'success'
		}

		const cleanupComplete = await cleanup(shares)
		if (cleanupComplete) {
			showInfo(t('share_via_device', 'Sharing was cancelled. The new public links were removed.'))
		} else {
			showError(t('share_via_device', 'Sharing was cancelled, but cleanup may be incomplete. Check Nextcloud’s standard Share panel.'))
		}
		return 'cancelled'
	} catch (error) {
		loading?.hideToast()
		if (error instanceof ShareApiError) {
			showError(error.message)
		} else {
			console.error('Share via Device failed', error)
			showError(t('share_via_device', 'Could not prepare the selected items for sharing.'))
		}
		return 'failed'
	}
}

const action: IFileAction = {
	id: 'share-via-device',
	order: 31,
	displayName: () => t('share_via_device', 'Share via device'),
	iconSvgInline: () => ShareVariantSvg,
	enabled: ({ nodes }) => canOfferAction(nodes),
	async exec(context) {
		const results = await this.execBatch!(context)
		return results[0] ?? null
	},
	async execBatch({ nodes }) {
		const result = await runShareFlow(nodes)
		if (result === 'failed') {
			return nodes.map(() => false)
		}
		if (result === 'cancelled') {
			return nodes.map(() => null)
		}
		return nodes.map(() => true)
	},
}

registerFileAction(action)
