/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CreatedShare } from '../src/types.ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@nextcloud/l10n', () => ({
	t: (_app: string, text: string) => text,
}))

import { prepareSharePayload } from '../src/sharePayload.ts'

function share(id: string, name: string): CreatedShare {
	return {
		id,
		name,
		path: `/${name}`,
		url: `https://cloud.example/s/${id}`,
	}
}

describe('prepareSharePayload', () => {
	beforeEach(() => vi.clearAllMocks())

	it('uses the URL field for one item', () => {
		const result = prepareSharePayload([share('one', 'Report.pdf')])

		expect(result.data).toEqual({
			title: 'Report.pdf',
			text: 'Shared from Nextcloud',
			url: 'https://cloud.example/s/one',
		})
		expect(result.copyText).toBe('Report.pdf: https://cloud.example/s/one')
	})

	it('puts every item into text for a multi-item share', () => {
		const result = prepareSharePayload([
			share('one', 'A.txt'),
			share('two', 'Folder B'),
		])

		expect(result.data.url).toBeUndefined()
		expect(result.data.text).toBe([
			'A.txt: https://cloud.example/s/one',
			'Folder B: https://cloud.example/s/two',
		].join('\n'))
	})

	it('rejects an empty link list', () => {
		expect(() => prepareSharePayload([])).toThrow('At least one public link is required')
	})
})
