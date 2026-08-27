/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface CreatedShare {
	id: string
	name: string
	path: string
	url: string
}

export interface CreateSharesResponse {
	shares: CreatedShare[]
}

export interface DeleteSharesResponse {
	deleted: number
	complete: boolean
}

export interface ApiErrorResponse {
	code?: string
	message?: string
}

export type FlowResult = 'success' | 'cancelled' | 'failed'

export type ShareAttemptResult = 'success' | 'cancelled' | 'unavailable'
