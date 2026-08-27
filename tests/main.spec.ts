/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { INode } from '@nextcloud/files'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	createPublicLinks: vi.fn(),
	deletePublicLinks: vi.fn(),
	presentShareOptions: vi.fn(),
	showError: vi.fn(),
	showInfo: vi.fn(),
	showLoading: vi.fn(),
	showWarning: vi.fn(),
	hideToast: vi.fn(),
	registerFileAction: vi.fn(),
}))

vi.mock('@nextcloud/capabilities', () => ({
	getCapabilities: () => ({
		files_sharing: {
			api_enabled: true,
			public: {
				enabled: true,
				password: { enforced: false },
			},
		},
	}),
}))

vi.mock('@nextcloud/dialogs', () => ({
	showError: mocks.showError,
	showInfo: mocks.showInfo,
	showLoading: mocks.showLoading,
	showWarning: mocks.showWarning,
}))

vi.mock('@nextcloud/files', () => ({
	Permission: { SHARE: 16 },
	registerFileAction: mocks.registerFileAction,
}))

vi.mock('@nextcloud/l10n', () => ({
	t: (_app: string, text: string, placeholders?: Record<string, string | number>) => placeholders
		? text.replace('{count}', String(placeholders.count))
		: text,
}))

vi.mock('../src/api.ts', () => ({
	createPublicLinks: mocks.createPublicLinks,
	deletePublicLinks: mocks.deletePublicLinks,
	ShareApiError: class ShareApiError extends Error {},
}))

vi.mock('../src/dialog.ts', () => ({
	presentShareOptions: mocks.presentShareOptions,
}))

vi.mock('../src/webShare.ts', () => ({
	hasTransientActivation: () => false,
	shareWithSystem: vi.fn(),
	supportsSystemShare: () => false,
}))

import { runShareFlow } from '../src/main.ts'

const node = {
	path: '/Report.pdf',
	root: '/files/ldh',
	permissions: 16,
} as INode

describe('sharing flow cleanup', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.showLoading.mockReturnValue({ hideToast: mocks.hideToast })
		mocks.createPublicLinks.mockResolvedValue([{
			id: 'ocinternal:42',
			name: 'Report.pdf',
			path: '/Report.pdf',
			url: 'https://cloud.example/s/abc',
		}])
	})

	it('removes only the newly created IDs after cancellation', async () => {
		mocks.presentShareOptions.mockResolvedValue('cancelled')
		mocks.deletePublicLinks.mockResolvedValue(true)

		await expect(runShareFlow([node])).resolves.toBe('cancelled')

		expect(mocks.deletePublicLinks).toHaveBeenCalledWith(['ocinternal:42'])
		expect(mocks.showInfo).toHaveBeenCalledWith('Sharing was cancelled. The new public links were removed.')
		expect(mocks.showError).not.toHaveBeenCalled()
	})

	it('reports an incomplete cancellation cleanup instead of claiming success', async () => {
		mocks.presentShareOptions.mockResolvedValue('cancelled')
		mocks.deletePublicLinks.mockResolvedValue(false)

		await expect(runShareFlow([node])).resolves.toBe('cancelled')

		expect(mocks.showInfo).not.toHaveBeenCalled()
		expect(mocks.showError).toHaveBeenCalledWith(
			'Sharing was cancelled, but cleanup may be incomplete. Check Nextcloud’s standard Share panel.',
		)
	})

	it('keeps links after a successful handoff', async () => {
		mocks.presentShareOptions.mockResolvedValue('success')

		await expect(runShareFlow([node])).resolves.toBe('success')
		expect(mocks.deletePublicLinks).not.toHaveBeenCalled()
	})
})
