<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Lee Soda <dhflyfree03@naver.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\ShareViaDevice\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\DataResponse;
use OCP\Constants;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\IL10N;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\IUser;
use OCP\IUserSession;
use OCP\Share\Exceptions\ShareNotFound;
use OCP\Share\IManager;
use OCP\Share\IShare;
use Psr\Log\LoggerInterface;
use Throwable;

final class ShareController extends Controller {
	private const BATCH_SIZE = 100;
	private const SHARE_LABEL = 'Share via Device';

	public function __construct(
		string $appName,
		IRequest $request,
		private readonly IRootFolder $rootFolder,
		private readonly IUserSession $userSession,
		private readonly IManager $shareManager,
		private readonly IURLGenerator $urlGenerator,
		private readonly IL10N $l10n,
		private readonly LoggerInterface $logger,
	) {
		parent::__construct($appName, $request);
	}

	/**
	 * Create fresh read-only public links for at most one internal batch.
	 * The client sends as many batches as necessary, so selection count is not capped.
	 *
	 * @param list<string> $paths
	 * @return DataResponse<Http::STATUS_OK, array{shares: list<array{id: string, name: string, path: string, url: string}>}, array{}>
	 */
	#[NoAdminRequired]
	#[UserRateLimit(limit: 10, period: 60)]
	public function create(array $paths = []): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return $this->error('not_authenticated', $this->l10n->t('You must be signed in.'), Http::STATUS_UNAUTHORIZED);
		}

		$policyError = $this->validateSharingPolicy($user);
		if ($policyError !== null) {
			return $policyError;
		}

		$validatedPaths = $this->validatePaths($paths);
		if ($validatedPaths instanceof DataResponse) {
			return $validatedPaths;
		}

		$userFolder = $this->rootFolder->getUserFolder($user->getUID());
		$created = [];
		$response = [];

		try {
			foreach ($validatedPaths as $path) {
				$node = $this->resolveShareableNode($userFolder, $path);
				$share = $this->shareManager->newShare();
				$share->setShareType(IShare::TYPE_LINK)
					->setNode($node)
					->setSharedBy($user->getUID())
					->setPermissions(Constants::PERMISSION_READ)
					->setLabel(self::SHARE_LABEL);

				$share = $this->shareManager->createShare($share);
				$created[] = $share;
				$response[] = [
					'id' => $share->getFullId(),
					'name' => $node->getName(),
					'path' => $path,
					'url' => $this->urlGenerator->linkToRouteAbsolute(
						'files_sharing.sharecontroller.showShare',
						['token' => $share->getToken()],
					),
				];
			}
		} catch (NotFoundException $exception) {
			if (!$this->rollback($created)) {
				return $this->rollbackError();
			}
			return $this->error('not_found', $this->l10n->t('A selected file or folder no longer exists.'), Http::STATUS_NOT_FOUND);
		} catch (Throwable $exception) {
			$rolledBack = $this->rollback($created);
			$this->logger->error('Unable to create public links for device sharing.', [
				'app' => $this->appName,
				'exception' => $exception,
			]);
			if (!$rolledBack) {
				return $this->rollbackError();
			}
			return $this->error('create_failed', $this->l10n->t('Could not create all public links. No new links were kept.'), Http::STATUS_BAD_REQUEST);
		}

		return new DataResponse(['shares' => $response]);
	}

	/**
	 * Delete links created by this app for the signed-in user.
	 *
	 * @param list<string> $shareIds
	 * @return DataResponse<Http::STATUS_OK, array{deleted: int, complete: bool}, array{}>
	 */
	#[NoAdminRequired]
	public function delete(array $shareIds = []): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return $this->error('not_authenticated', $this->l10n->t('You must be signed in.'), Http::STATUS_UNAUTHORIZED);
		}

		if (count($shareIds) > self::BATCH_SIZE) {
			return $this->error('batch_too_large', $this->l10n->t('Too many links were sent in one internal batch.'), Http::STATUS_BAD_REQUEST);
		}

		$deleted = 0;
		$failed = 0;
		foreach (array_values(array_unique($shareIds)) as $shareId) {
			if (!is_string($shareId) || $shareId === '') {
				$failed++;
				continue;
			}

			try {
				$share = $this->shareManager->getShareById($shareId);
				if (!$this->mayDelete($share, $user->getUID())) {
					$failed++;
					continue;
				}
				$this->shareManager->deleteShare($share);
				$deleted++;
			} catch (ShareNotFound) {
				// Cleanup is idempotent: an already removed link counts as done.
			} catch (Throwable $exception) {
				$failed++;
				$this->logger->warning('Unable to remove a device-sharing link during cleanup.', [
					'app' => $this->appName,
					'shareId' => $shareId,
					'exception' => $exception,
				]);
			}
		}

		return new DataResponse([
			'deleted' => $deleted,
			'complete' => $failed === 0,
		]);
	}

	private function validateSharingPolicy(IUser $user): ?DataResponse {
		if (!$this->shareManager->shareApiEnabled()
			|| $this->shareManager->sharingDisabledForUser($user->getUID())
			|| !$this->shareManager->shareApiAllowLinks($user)) {
			return $this->error(
				'public_links_disabled',
				$this->l10n->t('Public link sharing is not available for your account.'),
				Http::STATUS_FORBIDDEN,
			);
		}

		if ($this->shareManager->shareApiLinkEnforcePassword()) {
			return $this->error(
				'password_required',
				$this->l10n->t('Your server requires a password for public links. Use Nextcloud’s standard sharing panel.'),
				Http::STATUS_CONFLICT,
			);
		}

		return null;
	}

	/**
	 * @param list<mixed> $paths
	 * @return list<string>|DataResponse
	 */
	private function validatePaths(array $paths): array|DataResponse {
		if ($paths === []) {
			return $this->error('empty_selection', $this->l10n->t('Select at least one file or folder.'), Http::STATUS_BAD_REQUEST);
		}

		if (count($paths) > self::BATCH_SIZE) {
			return $this->error('batch_too_large', $this->l10n->t('Too many items were sent in one internal batch.'), Http::STATUS_BAD_REQUEST);
		}

		$result = [];
		foreach ($paths as $path) {
			if (!is_string($path) || $path === '' || str_contains($path, "\0")) {
				return $this->error('invalid_path', $this->l10n->t('A selected path is invalid.'), Http::STATUS_BAD_REQUEST);
			}
			$normalized = '/' . ltrim($path, '/');
			if (in_array('..', explode('/', $normalized), true)) {
				return $this->error('invalid_path', $this->l10n->t('A selected path is invalid.'), Http::STATUS_BAD_REQUEST);
			}
			$result[$normalized] = $normalized;
		}

		return array_values($result);
	}

	private function resolveShareableNode(Folder $userFolder, string $path): Node {
		$node = $userFolder->get(ltrim($path, '/'));
		$permissions = 0;
		foreach ($userFolder->getById($node->getId()) as $sameNode) {
			$permissions |= $sameNode->getPermissions();
		}

		if (($permissions & Constants::PERMISSION_SHARE) !== Constants::PERMISSION_SHARE) {
			throw new \InvalidArgumentException($this->l10n->t('You are not allowed to share one of the selected items.'));
		}

		return $node;
	}

	/** @param list<IShare> $shares */
	private function rollback(array $shares): bool {
		$complete = true;
		foreach (array_reverse($shares) as $share) {
			try {
				$this->shareManager->deleteShare($share);
			} catch (Throwable $exception) {
				$complete = false;
				$this->logger->critical('Rollback could not remove a newly created device-sharing link.', [
					'app' => $this->appName,
					'shareId' => $share->getFullId(),
					'exception' => $exception,
				]);
			}
		}

		return $complete;
	}

	private function mayDelete(IShare $share, string $userId): bool {
		return $share->getShareType() === IShare::TYPE_LINK
			&& $share->getSharedBy() === $userId
			&& $share->getLabel() === self::SHARE_LABEL;
	}

	private function error(string $code, string $message, int $status): DataResponse {
		return new DataResponse([
			'code' => $code,
			'message' => $message,
		], $status);
	}

	private function rollbackError(): DataResponse {
		return $this->error(
			'rollback_incomplete',
			$this->l10n->t('Link creation failed and cleanup may be incomplete. Check Nextcloud’s standard Share panel.'),
			Http::STATUS_INTERNAL_SERVER_ERROR,
		);
	}
}
