// {{Wikipedia:USync |repo=https://github.com/DVRTed/AINB-helper |ref=refs/heads/production |path=changelog.js}}
/* <nowiki>
== 2.0.1 (2026-11-09) ==

=== Performance Improvements ===

* '''edit-table:''' cache page wikitext and validate by revid ([https://github.com/DVRTed/AINB-helper/commit/bf634967d0814433b2222eaf275a3657f130fbb8 bf63496])

== 2.0.0 (2026-11-08) ==

=== ⚠ BREAKING CHANGES ===

* switch to a new template-aware row parser

=== Features ===

* '''edit-table:''' support templates inside notes via new row parser ([https://github.com/DVRTed/AINB-helper/commit/964b1433ebbe0eaaf70039d7c98ce05f59bfdad4 964b143])
* '''llmprod:''' add support for templates inside notes when updating tracker ([https://github.com/DVRTed/AINB-helper/commit/c9f0186a4b934f6cf3f5114b6e57c53b38def1e0 c9f0186])
* '''rebuild-table:''' add support for templates inside notes when rebuilding table ([https://github.com/DVRTed/AINB-helper/commit/2a2969c53d96d0128cffca7457829ff4def9d63b 2a2969c])

=== Bug Fixes ===

* '''edit-table:''' scope row "updating" indicator to the edited table ([https://github.com/DVRTed/AINB-helper/commit/0798712a72c091bd9f1b97690060c71442016733 0798712])

== 1.12.0 (2026-11-06) ==

=== Features ===

* '''author-highlight:''' add prev/next navigation between highlighted regions ([https://github.com/DVRTed/AINB-helper/commit/7d2691a3bc5830d5fd91dfbc7e971cdf28c62790 7d2691a])

== 1.11.0 (2026-11-05) ==

=== Features ===

* '''main-app:''' refresh case page after creating a tracking table ([https://github.com/DVRTed/AINB-helper/commit/aeeac493e405f7c4394cfb7bab8a52363a83efec aeeac49])

=== Bug Fixes ===

* '''edit-table:''' re-initialize other scripts (e.g., navpopups) on refresh ([https://github.com/DVRTed/AINB-helper/commit/d52dde3014998fe3dee174684fef627c84c4da13 d52dde3])

== 1.10.0 (2026-11-05) ==

=== Features ===

* show a completion message instead of the progress bar on completed trackers ([https://github.com/DVRTed/AINB-helper/commit/e747de306507707a0c7bad296cf9417d7785b06a e747de3])

== 1.9.1 (2026-11-04) ==

=== Bug Fixes ===

* '''edit-table:''' stop breaking DiscussionTools' Reply buttons ([https://github.com/DVRTed/AINB-helper/commit/9fb6581d4e9379a74aba112775cca214d787e2b6 9fb6581])

== 1.9.0 (2026-11-03) ==

=== Features ===

* '''author-highlight:''' show messages when no content is found or highlightable ([https://github.com/DVRTed/AINB-helper/commit/4311d42c1733ccf5e9148af7a6962c0cde1449d3 4311d42])
* show authorship percentage by characters instead of tokens ([https://github.com/DVRTed/AINB-helper/commit/9011b4a095ca74a944e0e202a2745e7c3d6133fe 9011b4a])

== 1.8.0 (2026-11-03) ==

=== Features ===

* '''main-app:''' use User-ainb template to link multiple users ([https://github.com/DVRTed/AINB-helper/commit/bc4627ecf97e27801d7917a7d5a57aa12271c9bc bc4627e])
* '''rebuild-table:''' support populating multiple usernames ([https://github.com/DVRTed/AINB-helper/commit/fc99ed14e2bd73574ee5c4384bd0e060d69e8581 fc99ed1])

== 1.7.0 (2026-11-02) ==

=== Features ===

* '''rebuild-table:''' add option to delete only to-do entries and improve edit summary ([https://github.com/DVRTed/AINB-helper/commit/9b183b7334ad510e46df5728d37240935ba2a4f6 9b183b7])

=== Bug Fixes ===

* avoid duplicate Vue IDs across mounted apps ([https://github.com/DVRTed/AINB-helper/commit/3499d6aba9932f3fd594690e9685fce4451371cb 3499d6a])

== 1.6.0 (2026-11-02) ==

=== Features ===

* add convenient edit summaries above tracking tables ([https://github.com/DVRTed/AINB-helper/commit/8cad72248f22d3003fb1328ef915c9c24d602376 8cad722])

== 1.5.1 (2026-11-01) ==

=== Bug Fixes ===

* '''llmprod:''' prevent overwriting concurrent edits in the tracking table ([https://github.com/DVRTed/AINB-helper/commit/67559b5a57d5428c7cff2e403fb213256b818050 67559b5])

== 1.5.0 (2026-11-01) ==

=== Features ===

* '''author-highlight:''' open edit page in a new tab ([https://github.com/DVRTed/AINB-helper/commit/fcd451f96324226d58aac918ac05f0a05afa8ca2 fcd451f])
* '''author-highlight:''' scroll to first highlighted segment on open ([https://github.com/DVRTed/AINB-helper/commit/be79e975e59d59e667ab8c2a53958b79cf3c8b6b be79e97])

== 1.4.0 (2026-10-31) ==

=== Features ===

* add confirmation dialog before removing author's content ([https://github.com/DVRTed/AINB-helper/commit/5fec53f87e7aa6085301eebd82b1829a0880781e 5fec53f])

=== Bug Fixes ===

* '''edit-table:''' prevent unsaved changes from being lost when reindexing tables ([https://github.com/DVRTed/AINB-helper/commit/d977525a646750642408de975b54598e28280eb4 d977525])

== 1.3.2 (2026-10-31) ==

=== Bug Fixes ===

* widen preview dialog to avoid cramped layout ([https://github.com/DVRTed/AINB-helper/commit/915d21556f2e8af2102909f9545805b14bd4bf5c 915d215])

== 1.3.1 (2026-10-31) ==

=== Bug Fixes ===

* prevent edit table styles from leaking ([https://github.com/DVRTed/AINB-helper/commit/b36e27c82765a0a73de049d378c109469007bc7f b36e27c])

== 1.3.0 (2026-10-31) ==

=== Features ===

* '''edit-table:''' add page-creation filter to batch edit ([https://github.com/DVRTed/AINB-helper/commit/49062f2c4976cb79a7dc0a4ac1c9d7e390f67b3c 49062f2])
* '''llmprod:''' show preview in its own dialog ([https://github.com/DVRTed/AINB-helper/commit/2753a587058903152bf617ccb6c0245584742ba4 2753a58])
* '''new-case-app:''' add show preview button ([https://github.com/DVRTed/AINB-helper/commit/e8f0483334b2f21ede7adba2d3d73ea706665ebb e8f0483])

=== Bug Fixes ===

* '''edit-table:''' prevent footer buttons jumping after rows load ([https://github.com/DVRTed/AINB-helper/commit/ab4be6016e4b65b2b1964b0cb4cf1b42b41e4cc1 ab4be60])
* '''main-app:''' improve diff view rendering ([https://github.com/DVRTed/AINB-helper/commit/d8e8f7165daeb4e5b078669b63be88294eed7d2d d8e8f71])
* status column sorting on cleanup tables ([https://github.com/DVRTed/AINB-helper/commit/a6fcd5e82a9ca76b2442806a339e6e7632670cd5 a6fcd5e])

== 1.2.2 (2026-10-31) ==

=== Bug Fixes ===

* '''edit-table:''' make batch-edit usable on mobile viewport ([https://github.com/DVRTed/AINB-helper/commit/8c29c65bc63826abb527ca3e9f4793505c4415db 8c29c65])

== 1.2.1 (2026-10-30) ==

=== Bug Fixes ===

* handle zero-byte diffs in note editor ([https://github.com/DVRTed/AINB-helper/commit/6369896872d282baecdf2c1b5fe9344fab972d2f 6369896])

== 1.2.0 (2026-10-30) ==

=== Features ===

* add dark mode support using Codex color palette ([https://github.com/DVRTed/AINB-helper/commit/c880aa4c322a1e6def44b94931343a1731c6e310 c880aa4])
* '''edit-table:''' improve batch editing UI and add bulk status updates ([https://github.com/DVRTed/AINB-helper/commit/94210c334ce0782d8c4ff235f8e4270099ded24a 94210c3])

=== Bug Fixes ===

* '''edit-table:''' widen the single-row edit menu's inputs to prevent unnecessary scrolling ([https://github.com/DVRTed/AINB-helper/commit/7ac5a17f13caa41ac304f398ca2d50a128ac106c 7ac5a17])
* '''new-case-app:''' prevent case type dropdown from being clipped ([https://github.com/DVRTed/AINB-helper/commit/0343cf053ddbeea8ac23a1f374504f8c3ccaf8e1 0343cf0])
* remove confusing progress bar from cleanup category ([https://github.com/DVRTed/AINB-helper/commit/927fe5ba57aa32f25565159496c3327c5b01c26f 927fe5b])
* retain tracking table filters when editing rows ([https://github.com/DVRTed/AINB-helper/commit/3955b2c13a697f4699376299b964271082fb369f 3955b2c])

== 1.1.2 (2026-10-29) ==

=== Bug Fixes ===

* '''edit-banner:''' widen the select menu to avoid unnecessary scrolling ([https://github.com/DVRTed/AINB-helper/commit/83d23b8b1ead8ff336f3a4ba56d992120619b308 83d23b8])

== 1.1.1 (2026-10-29) ==

=== Bug Fixes ===

* '''edit-banner:''' correct llmprod and conduct labels, drop "requested" from llmprod ([https://github.com/DVRTed/AINB-helper/commit/35152edc19fc2f8f74ee32517d51aa4e5cc30463 35152ed])

== 1.1.0 (2026-10-28) ==

=== Features ===

* add option to reindex existing tables ([https://github.com/DVRTed/AINB-helper/commit/dfb6f568aeac43346fa46a6e3c72841648c8a2f2 dfb6f56])
* collapse case options into a menu ([https://github.com/DVRTed/AINB-helper/commit/bd187ceb716d60f2ca0017d1713fe3b47ba9af61 bd187ce])
* support editing entries duplicated across multiple tables ([https://github.com/DVRTed/AINB-helper/commit/72eec60845e92aada42d235409f6c895f1c5aee0 72eec60])

=== Bug Fixes ===

* correct wording of the reindex edit summary ([https://github.com/DVRTed/AINB-helper/commit/08024df4ab508150a71459a3c2ea76e625317156 08024df])
* '''edit-table:''' lock duplicated entry in batch edit instead of fatal erroring ([https://github.com/DVRTed/AINB-helper/commit/5cfdda30152a92daccbe62aadecd5d2d0e66788f 5cfdda3])
* populate multiple found usernames in "Add tracking table" ([https://github.com/DVRTed/AINB-helper/commit/6b4074023cd2a953459b2039463d22749fc6f658 6b40740])
</nowiki> */
