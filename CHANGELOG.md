# Changelog

## [2.1.1](https://github.com/DVRTed/AINB-helper/compare/v2.1.0...v2.1.1) (2026-11-10)


### Performance Improvements

* **edit-table:** update page cache after saving ([24e7f62](https://github.com/DVRTed/AINB-helper/commit/24e7f628057a7ac4ceb850956f7a42b2f2b6a7ea))

## [2.1.0](https://github.com/DVRTed/AINB-helper/compare/v2.0.1...v2.1.0) (2026-11-09)


### Features

* **main-app:** sort tags by edit count ([46c1cad](https://github.com/DVRTed/AINB-helper/commit/46c1cad7005d5f1c1c228821e64247cbb8761d09))

## [2.0.1](https://github.com/DVRTed/AINB-helper/compare/v2.0.0...v2.0.1) (2026-11-09)


### Performance Improvements

* **edit-table:** cache page wikitext and validate by revid ([bf63496](https://github.com/DVRTed/AINB-helper/commit/bf634967d0814433b2222eaf275a3657f130fbb8))

## [2.0.0](https://github.com/DVRTed/AINB-helper/compare/v1.12.0...v2.0.0) (2026-11-08)


### ⚠ BREAKING CHANGES

* switch to a new template-aware row parser

### Features

* **edit-table:** support templates inside notes via new row parser ([964b143](https://github.com/DVRTed/AINB-helper/commit/964b1433ebbe0eaaf70039d7c98ce05f59bfdad4))
* **llmprod:** add support for templates inside notes when updating tracker ([c9f0186](https://github.com/DVRTed/AINB-helper/commit/c9f0186a4b934f6cf3f5114b6e57c53b38def1e0))
* **rebuild-table:** add support for templates inside notes when rebuilding table ([2a2969c](https://github.com/DVRTed/AINB-helper/commit/2a2969c53d96d0128cffca7457829ff4def9d63b))


### Bug Fixes

* **edit-table:** scope row "updating" indicator to the edited table ([0798712](https://github.com/DVRTed/AINB-helper/commit/0798712a72c091bd9f1b97690060c71442016733))

## [1.12.0](https://github.com/DVRTed/AINB-helper/compare/v1.11.0...v1.12.0) (2026-11-06)


### Features

* **author-highlight:** add prev/next navigation between highlighted regions ([7d2691a](https://github.com/DVRTed/AINB-helper/commit/7d2691a3bc5830d5fd91dfbc7e971cdf28c62790))

## [1.11.0](https://github.com/DVRTed/AINB-helper/compare/v1.10.0...v1.11.0) (2026-11-05)


### Features

* **main-app:** refresh case page after creating a tracking table ([aeeac49](https://github.com/DVRTed/AINB-helper/commit/aeeac493e405f7c4394cfb7bab8a52363a83efec))


### Bug Fixes

* **edit-table:** re-initialize other scripts (e.g., navpopups) on refresh ([d52dde3](https://github.com/DVRTed/AINB-helper/commit/d52dde3014998fe3dee174684fef627c84c4da13))

## [1.10.0](https://github.com/DVRTed/AINB-helper/compare/v1.9.1...v1.10.0) (2026-11-05)


### Features

* show a completion message instead of the progress bar on completed trackers ([e747de3](https://github.com/DVRTed/AINB-helper/commit/e747de306507707a0c7bad296cf9417d7785b06a))

## [1.9.1](https://github.com/DVRTed/AINB-helper/compare/v1.9.0...v1.9.1) (2026-11-04)


### Bug Fixes

* **edit-table:** stop breaking DiscussionTools' Reply buttons ([9fb6581](https://github.com/DVRTed/AINB-helper/commit/9fb6581d4e9379a74aba112775cca214d787e2b6))

## [1.9.0](https://github.com/DVRTed/AINB-helper/compare/v1.8.0...v1.9.0) (2026-11-03)


### Features

* **author-highlight:** show messages when no content is found or highlightable ([4311d42](https://github.com/DVRTed/AINB-helper/commit/4311d42c1733ccf5e9148af7a6962c0cde1449d3))
* show authorship percentage by characters instead of tokens ([9011b4a](https://github.com/DVRTed/AINB-helper/commit/9011b4a095ca74a944e0e202a2745e7c3d6133fe))

## [1.8.0](https://github.com/DVRTed/AINB-helper/compare/v1.7.0...v1.8.0) (2026-11-03)


### Features

* **main-app:** use User-ainb template to link multiple users ([bc4627e](https://github.com/DVRTed/AINB-helper/commit/bc4627ecf97e27801d7917a7d5a57aa12271c9bc))
* **rebuild-table:** support populating multiple usernames ([fc99ed1](https://github.com/DVRTed/AINB-helper/commit/fc99ed14e2bd73574ee5c4384bd0e060d69e8581))

## [1.7.0](https://github.com/DVRTed/AINB-helper/compare/v1.6.0...v1.7.0) (2026-11-02)


### Features

* **rebuild-table:** add option to delete only to-do entries and improve edit summary ([9b183b7](https://github.com/DVRTed/AINB-helper/commit/9b183b7334ad510e46df5728d37240935ba2a4f6))


### Bug Fixes

* avoid duplicate Vue IDs across mounted apps ([3499d6a](https://github.com/DVRTed/AINB-helper/commit/3499d6aba9932f3fd594690e9685fce4451371cb))

## [1.6.0](https://github.com/DVRTed/AINB-helper/compare/v1.5.1...v1.6.0) (2026-11-02)


### Features

* add convenient edit summaries above tracking tables ([8cad722](https://github.com/DVRTed/AINB-helper/commit/8cad72248f22d3003fb1328ef915c9c24d602376))

## [1.5.1](https://github.com/DVRTed/AINB-helper/compare/v1.5.0...v1.5.1) (2026-11-01)


### Bug Fixes

* **llmprod:** prevent overwriting concurrent edits in the tracking table ([67559b5](https://github.com/DVRTed/AINB-helper/commit/67559b5a57d5428c7cff2e403fb213256b818050))

## [1.5.0](https://github.com/DVRTed/AINB-helper/compare/v1.4.0...v1.5.0) (2026-11-01)


### Features

* **author-highlight:** open edit page in a new tab ([fcd451f](https://github.com/DVRTed/AINB-helper/commit/fcd451f96324226d58aac918ac05f0a05afa8ca2))
* **author-highlight:** scroll to first highlighted segment on open ([be79e97](https://github.com/DVRTed/AINB-helper/commit/be79e975e59d59e667ab8c2a53958b79cf3c8b6b))

## [1.4.0](https://github.com/DVRTed/AINB-helper/compare/v1.3.2...v1.4.0) (2026-10-31)


### Features

* add confirmation dialog before removing author's content ([5fec53f](https://github.com/DVRTed/AINB-helper/commit/5fec53f87e7aa6085301eebd82b1829a0880781e))


### Bug Fixes

* **edit-table:** prevent unsaved changes from being lost when reindexing tables ([d977525](https://github.com/DVRTed/AINB-helper/commit/d977525a646750642408de975b54598e28280eb4))

## [1.3.2](https://github.com/DVRTed/AINB-helper/compare/v1.3.1...v1.3.2) (2026-10-31)


### Bug Fixes

* widen preview dialog to avoid cramped layout ([915d215](https://github.com/DVRTed/AINB-helper/commit/915d21556f2e8af2102909f9545805b14bd4bf5c))

## [1.3.1](https://github.com/DVRTed/AINB-helper/compare/v1.3.0...v1.3.1) (2026-10-31)


### Bug Fixes

* prevent edit table styles from leaking ([b36e27c](https://github.com/DVRTed/AINB-helper/commit/b36e27c82765a0a73de049d378c109469007bc7f))

## [1.3.0](https://github.com/DVRTed/AINB-helper/compare/v1.2.2...v1.3.0) (2026-10-31)


### Features

* **edit-table:** add page-creation filter to batch edit ([49062f2](https://github.com/DVRTed/AINB-helper/commit/49062f2c4976cb79a7dc0a4ac1c9d7e390f67b3c))
* **llmprod:** show preview in its own dialog ([2753a58](https://github.com/DVRTed/AINB-helper/commit/2753a587058903152bf617ccb6c0245584742ba4))
* **new-case-app:** add show preview button ([e8f0483](https://github.com/DVRTed/AINB-helper/commit/e8f0483334b2f21ede7adba2d3d73ea706665ebb))


### Bug Fixes

* **edit-table:** prevent footer buttons jumping after rows load ([ab4be60](https://github.com/DVRTed/AINB-helper/commit/ab4be6016e4b65b2b1964b0cb4cf1b42b41e4cc1))
* **main-app:** improve diff view rendering ([d8e8f71](https://github.com/DVRTed/AINB-helper/commit/d8e8f7165daeb4e5b078669b63be88294eed7d2d))
* status column sorting on cleanup tables ([a6fcd5e](https://github.com/DVRTed/AINB-helper/commit/a6fcd5e82a9ca76b2442806a339e6e7632670cd5))

## [1.2.2](https://github.com/DVRTed/AINB-helper/compare/v1.2.1...v1.2.2) (2026-10-31)


### Bug Fixes

* **edit-table:** make batch-edit usable on mobile viewport ([8c29c65](https://github.com/DVRTed/AINB-helper/commit/8c29c65bc63826abb527ca3e9f4793505c4415db))

## [1.2.1](https://github.com/DVRTed/AINB-helper/compare/v1.2.0...v1.2.1) (2026-10-30)


### Bug Fixes

* handle zero-byte diffs in note editor ([6369896](https://github.com/DVRTed/AINB-helper/commit/6369896872d282baecdf2c1b5fe9344fab972d2f))

## [1.2.0](https://github.com/DVRTed/AINB-helper/compare/v1.1.2...v1.2.0) (2026-10-30)


### Features

* add dark mode support using Codex color palette ([c880aa4](https://github.com/DVRTed/AINB-helper/commit/c880aa4c322a1e6def44b94931343a1731c6e310))
* **edit-table:** improve batch editing UI and add bulk status updates ([94210c3](https://github.com/DVRTed/AINB-helper/commit/94210c334ce0782d8c4ff235f8e4270099ded24a))


### Bug Fixes

* **edit-table:** widen the single-row edit menu's inputs to prevent unnecessary scrolling ([7ac5a17](https://github.com/DVRTed/AINB-helper/commit/7ac5a17f13caa41ac304f398ca2d50a128ac106c))
* **new-case-app:** prevent case type dropdown from being clipped ([0343cf0](https://github.com/DVRTed/AINB-helper/commit/0343cf053ddbeea8ac23a1f374504f8c3ccaf8e1))
* remove confusing progress bar from cleanup category ([927fe5b](https://github.com/DVRTed/AINB-helper/commit/927fe5ba57aa32f25565159496c3327c5b01c26f))
* retain tracking table filters when editing rows ([3955b2c](https://github.com/DVRTed/AINB-helper/commit/3955b2c13a697f4699376299b964271082fb369f))

## [1.1.2](https://github.com/DVRTed/AINB-helper/compare/v1.1.1...v1.1.2) (2026-10-29)


### Bug Fixes

* **edit-banner:** widen the select menu to avoid unnecessary scrolling ([83d23b8](https://github.com/DVRTed/AINB-helper/commit/83d23b8b1ead8ff336f3a4ba56d992120619b308))

## [1.1.1](https://github.com/DVRTed/AINB-helper/compare/v1.1.0...v1.1.1) (2026-10-29)


### Bug Fixes

* **edit-banner:** correct llmprod and conduct labels, drop "requested" from llmprod ([35152ed](https://github.com/DVRTed/AINB-helper/commit/35152edc19fc2f8f74ee32517d51aa4e5cc30463))

## [1.1.0](https://github.com/DVRTed/AINB-helper/compare/v1.0.0...v1.1.0) (2026-10-28)


### Features

* add option to reindex existing tables ([dfb6f56](https://github.com/DVRTed/AINB-helper/commit/dfb6f568aeac43346fa46a6e3c72841648c8a2f2))
* collapse case options into a menu ([bd187ce](https://github.com/DVRTed/AINB-helper/commit/bd187ceb716d60f2ca0017d1713fe3b47ba9af61))
* support editing entries duplicated across multiple tables ([72eec60](https://github.com/DVRTed/AINB-helper/commit/72eec60845e92aada42d235409f6c895f1c5aee0))


### Bug Fixes

* correct wording of the reindex edit summary ([08024df](https://github.com/DVRTed/AINB-helper/commit/08024df4ab508150a71459a3c2ea76e625317156))
* **edit-table:** lock duplicated entry in batch edit instead of fatal erroring ([5cfdda3](https://github.com/DVRTed/AINB-helper/commit/5cfdda30152a92daccbe62aadecd5d2d0e66788f))
* populate multiple found usernames in "Add tracking table" ([6b40740](https://github.com/DVRTed/AINB-helper/commit/6b4074023cd2a953459b2039463d22749fc6f658))
