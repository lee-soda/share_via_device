/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post, remove } = vi.hoisted(() => ({
	post: vi.fn(),
	remove: vi.fn(),
}))

vi.mock('@nextcloud/axios', () => ({
	default: {
		post,
		delete: remove,
	},
	isAxiosError: (error: { isAxiosError?: boolean }) => error?.isAxiosError === true,
}))

vi.mock('@nextcloud/router', () => ({
	generateUrl: (path: string) => path,
}))

vi.mock('@nextcloud/l10n', () => ({
	t: (_app: string, text: string) => text,
}))

import { createPublicLinks, deletePublicLinks, INTERNAL_BATCH_SIZE } from '../src/api.ts'

describe('share API batching', () => {
	beforeEach(() => {
		post.mockReset()
		remove.mockReset()
		remove.mockResolvedValue({ data: { deleted: 0, complete: true } })
	})

	it('does not cap selection and sends bounded internal batches', async () => {
		const paths = Array.from({ length: 250 }, (_, index) => `/item-${index}`)
		post.mockImplementation(async (_url: string, body: { paths: string[] }) => ({
			data: {
				shares: body.paths.map((path) => ({
					id: `id-${path}`,
					name: path.slice(1),
					path,
					url: `https://cloud.example/s/${encodeURIComponent(path)}`,
				})),
			},
		}))

		const progress = vi.fn()
		const shares = await createPublicLinks(paths, progress)

		expect(shares).toHaveLength(250)
		expect(post).toHaveBeenCalledTimes(3)
		expect(post.mock.calls.map((call) => call[1].paths.length)).toEqual([100, 100, 50])
		expect(progress.mock.calls).toEqual([[100, 250], [200, 250], [250, 250]])
		expect(remove).not.toHaveBeenCalled()
		expect(INTERNAL_BATCH_SIZE).toBe(100)
	})

	it('rolls back every earlier batch when a later batch fails', async () => {
		const paths = Array.from({ length: 150 }, (_, index) => `/item-${index}`)
		post
			.mockResolvedValueOnce({
				data: {
					shares: paths.slice(0, 100).map((path) => ({
						id: `id-${path}`,
						name: path,
						path,
						url: `https://cloud.example/s/${path}`,
					})),
				},
			})
			.mockRejectedValueOnce(new Error('second batch failed'))

		await expect(createPublicLinks(paths)).rejects.toMatchObject({ code: 'request_failed' })
		expect(remove).toHaveBeenCalledTimes(1)
		expect(remove.mock.calls[0]![1].data.shareIds).toHaveLength(100)
	})

	it('waits for Retry-After and resumes without dropping the selection', async () => {
		post
			.mockRejectedValueOnce({
				isAxiosError: true,
				response: {
					status: 429,
					headers: { 'retry-after': '0' },
				},
			})
			.mockResolvedValueOnce({
				data: {
					shares: [{
						id: 'id-one',
						name: 'one',
						path: '/one',
						url: 'https://cloud.example/s/one',
					}],
				},
			})

		await expect(createPublicLinks(['/one'])).resolves.toHaveLength(1)
		expect(post).toHaveBeenCalledTimes(2)
	})

	it('continues cleanup after one delete batch fails', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
		remove
			.mockResolvedValueOnce({ data: { deleted: 100, complete: true } })
			.mockRejectedValueOnce(new Error('temporary failure'))
			.mockResolvedValueOnce({ data: { deleted: 50, complete: true } })

		await expect(deletePublicLinks(Array.from({ length: 250 }, (_, index) => `id-${index}`))).resolves.toBe(false)

		expect(remove).toHaveBeenCalledTimes(3)
		expect(consoleError).toHaveBeenCalledTimes(1)
		consoleError.mockRestore()
	})

	it('reports incomplete server cleanup', async () => {
		remove.mockResolvedValueOnce({ data: { deleted: 99, complete: false } })
		await expect(deletePublicLinks(Array.from({ length: 100 }, (_, index) => `id-${index}`))).resolves.toBe(false)
	})
})
