/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ApiErrorResponse, CreatedShare, CreateSharesResponse, DeleteSharesResponse } from './types.ts'
import axios, { isAxiosError } from '@nextcloud/axios'
import { t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'

export const INTERNAL_BATCH_SIZE = 100
const apiUrl = generateUrl('/apps/share_via_device/api/v1/shares')
const DEFAULT_RETRY_AFTER_SECONDS = 60

export class ShareApiError extends Error {
	public readonly code: string

	public constructor(code: string, message: string) {
		super(message)
		this.name = 'ShareApiError'
		this.code = code
	}
}

function chunks<T>(items: readonly T[], size: number): T[][] {
	const result: T[][] = []
	for (let index = 0; index < items.length; index += size) {
		result.push(items.slice(index, index + size))
	}
	return result
}

function normalizeError(error: unknown): ShareApiError {
	if (error instanceof ShareApiError) {
		return error
	}

	if (isAxiosError<ApiErrorResponse>(error)) {
		const code = error.response?.data?.code ?? 'request_failed'
		const message = error.response?.data?.message ?? error.message
		return new ShareApiError(code, message)
	}

	return new ShareApiError('request_failed', error instanceof Error ? error.message : 'Request failed')
}

function retryDelay(error: unknown): number | null {
	if (!isAxiosError(error) || error.response?.status !== 429) {
		return null
	}

	const rawHeader = error.response.headers?.['retry-after']
	const seconds = Number.parseInt(Array.isArray(rawHeader) ? rawHeader[0] : String(rawHeader ?? ''), 10)
	return Math.max(0, Number.isFinite(seconds) ? seconds : DEFAULT_RETRY_AFTER_SECONDS) * 1000
}

async function createBatch(paths: readonly string[]): Promise<CreateSharesResponse> {
	while (true) {
		try {
			const response = await axios.post<CreateSharesResponse>(apiUrl, { paths })
			return response.data
		} catch (error) {
			const delay = retryDelay(error)
			if (delay === null) {
				throw error
			}
			await new Promise((resolve) => window.setTimeout(resolve, delay))
		}
	}
}

export async function createPublicLinks(
	paths: readonly string[],
	onProgress?: (created: number, total: number) => void,
): Promise<CreatedShare[]> {
	const uniquePaths = [...new Set(paths)]
	const created: CreatedShare[] = []

	try {
		for (const batch of chunks(uniquePaths, INTERNAL_BATCH_SIZE)) {
			const response = await createBatch(batch)
			created.push(...response.shares)
			onProgress?.(created.length, uniquePaths.length)
		}
		return created
	} catch (error) {
		if (created.length > 0) {
			const cleanupComplete = await deletePublicLinks(created.map(({ id }) => id))
			if (!cleanupComplete) {
				throw new ShareApiError(
					'rollback_incomplete',
					t('share_via_device', 'Link creation failed and cleanup may be incomplete. Check Nextcloud’s standard Share panel.'),
				)
			}
		}
		throw normalizeError(error)
	}
}

export async function deletePublicLinks(shareIds: readonly string[]): Promise<boolean> {
	const uniqueIds = [...new Set(shareIds)]
	let complete = true
	for (const batch of chunks(uniqueIds, INTERNAL_BATCH_SIZE)) {
		try {
			const response = await axios.delete<DeleteSharesResponse>(apiUrl, { data: { shareIds: batch } })
			complete = response.data.complete && complete
		} catch (error) {
			complete = false
			// Cleanup is best-effort across every batch. Continue so one failed
			// request does not prevent later batches from being removed.
			console.error('Share via Device cleanup failed for one batch', normalizeError(error))
		}
	}
	return complete
}
