/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ShareAttemptResult } from './types.ts'

export function supportsSystemShare(data: ShareData, target: Navigator = navigator): boolean {
	if (typeof target.share !== 'function') {
		return false
	}

	return typeof target.canShare !== 'function' || target.canShare(data)
}

export function hasTransientActivation(target: Navigator = navigator): boolean {
	const activation = target.userActivation
	return activation === undefined || activation.isActive
}

export async function shareWithSystem(data: ShareData, target: Navigator = navigator): Promise<ShareAttemptResult> {
	if (!supportsSystemShare(data, target)) {
		return 'unavailable'
	}

	try {
		await target.share(data)
		return 'success'
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return 'cancelled'
		}
		return 'unavailable'
	}
}

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text)
			return true
		}
	} catch {
		// Fall through to the legacy, user-gesture-compatible copy path.
	}

	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.setAttribute('readonly', '')
	textarea.style.position = 'fixed'
	textarea.style.inset = '-1000px auto auto -1000px'
	document.body.appendChild(textarea)
	textarea.select()
	const copied = document.execCommand('copy')
	textarea.remove()
	return copied
}
