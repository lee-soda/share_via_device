param(
	[string]$Version = '1.0.0'
)

$ErrorActionPreference = 'Stop'
$appId = 'share_via_device'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = Join-Path $projectRoot 'build'
$stageRoot = Join-Path $buildRoot 'staging'
$appStage = Join-Path $stageRoot $appId
$artifactRoot = Join-Path $buildRoot 'artifacts'
$artifactPath = Join-Path $artifactRoot "$appId-v$Version.tar.gz"

Push-Location $projectRoot
try {
	[xml]$appInfo = Get-Content -LiteralPath (Join-Path $projectRoot 'appinfo/info.xml')
	if ($appInfo.info.version -ne $Version) {
		throw "Package version $Version does not match appinfo/info.xml version $($appInfo.info.version)."
	}

	npm run build
	if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }

	if (Test-Path -LiteralPath $appStage) {
		$resolvedStage = (Resolve-Path -LiteralPath $appStage).Path
		if ($resolvedStage -ne $appStage -or -not $resolvedStage.StartsWith($buildRoot + '\')) {
			throw "Unexpected staging path: $resolvedStage"
		}
		Remove-Item -LiteralPath $resolvedStage -Recurse -Force
	}

	New-Item -ItemType Directory -Path $appStage -Force | Out-Null
	New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null

	$runtimeEntries = @(
		'appinfo',
		'img',
		'js',
		'lib',
		'l10n',
		'CHANGELOG.md',
		'LICENSE',
		'README.md'
	)

	foreach ($entry in $runtimeEntries) {
		Copy-Item -LiteralPath (Join-Path $projectRoot $entry) -Destination $appStage -Recurse -Force
	}

	if (Test-Path -LiteralPath $artifactPath) {
		Remove-Item -LiteralPath $artifactPath -Force
	}

	tar -czf $artifactPath -C $stageRoot $appId
	if ($LASTEXITCODE -ne 0) { throw 'Archive creation failed.' }

	Get-FileHash -Algorithm SHA256 -LiteralPath $artifactPath
} finally {
	Pop-Location
}
