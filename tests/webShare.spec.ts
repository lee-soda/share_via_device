/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasTransientActivation, shareWithSystem, supportsSystemShare } from '../src/webShare.ts'

function fakeNavigator(overrides: Partial<Navigator>): Navigator {
	return overrides as Navigator
}

describe('Web Share integration', () => {
	beforeEach(() => vi.restoreAllMocks())

	it('reports unsupported browsers without calling share', async () => {
		const target = fakeNavigator({})
		expect(supportsSystemShare({ text: 'links' }, target)).toBe(false)
		expect(await shareWithSystem({ text: 'links' }, target)).toBe('unavailable')
	})

	it('treats an AbortError as user cancellation', async () => {
		const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
		const target = fakeNavigator({ share })

		expect(await shareWithSystem({ text: 'links' }, target)).toBe('cancelled')
		expect(share).toHaveBeenCalledOnce()
	})

	it('returns unavailable when the platform rejects the payload', async () => {
		const share = vi.fn()
		const target = fakeNavigator({
			share,
			canShare: () => false,
		})

		expect(await shareWithSystem({ text: 'too large' }, target)).toBe('unavailable')
		expect(share).not.toHaveBeenCalled()
	})

	it('checks transient user activation when the browser exposes it', () => {
		expect(hasTransientActivation(fakeNavigator({
			userActivation: { hasBeenActive: true, isActive: false },
		}))).toBe(false)
		expect(hasTransientActivation(fakeNavigator({
			userActivation: { hasBeenActive: true, isActive: true },
		}))).toBe(true)
	})
})
