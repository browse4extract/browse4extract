# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.2.0](https://github.com/browse4extract/browse4extract/compare/v1.1.3...v1.2.0) (2025-11-12)


### Features

* add Intel macOS builds support ([ec027ed](https://github.com/browse4extract/browse4extract/commit/ec027ed6cadf9574b9d78008f397a1ddd5ea8890))
* add macOS Intel (x64) builds using separate GitHub runners ([1c8b24b](https://github.com/browse4extract/browse4extract/commit/1c8b24b591dfda398bbc3c754b4ffdfbde9fced8))


### Bug Fixes

* update version API with correct download links and brand design ([78bfa84](https://github.com/browse4extract/browse4extract/commit/78bfa8465e737b7f3c59e5486e959fd8020c7832)), closes [#6fbb69](https://github.com/browse4extract/browse4extract/issues/6fbb69) [#bf8fd7](https://github.com/browse4extract/browse4extract/issues/bf8fd7)

### [1.1.3](https://github.com/browse4extract/browse4extract/compare/v1.1.1...v1.1.3) (2025-11-12)


### Bug Fixes

* extension files creation ([a20a679](https://github.com/browse4extract/browse4extract/commit/a20a67901d1f526c0a83490dcb61b2e7a263d1ab))
* include package-lock.json for reproducible builds and fix CI ([38985af](https://github.com/browse4extract/browse4extract/commit/38985af1c5ef3712b1f95ae7e092a8b378eb3d77))


### Documentation

* add comprehensive documentation system ([91baec5](https://github.com/browse4extract/browse4extract/commit/91baec5bc9f8bdc56413c97b084380b7394a1fb0))
* update security documentation with all fixes ([e104326](https://github.com/browse4extract/browse4extract/commit/e104326bd91d719ce66ab7c009e81a4b2e2bed68))


### Chores

* **release:** 1.1.2 ([a1bff9a](https://github.com/browse4extract/browse4extract/commit/a1bff9a9bab1f4bfafe689252b292b4be2f222b3))

### [1.1.2](https://github.com/browse4extract/browse4extract/compare/v1.1.1...v1.1.2) (2025-11-12)


### Security Improvements

* **renderer sandboxing:** enable sandbox mode for enhanced process isolation ([f7431b0](https://github.com/browse4extract/browse4extract/commit/f7431b0))
* **ipc rate limiting:** implement comprehensive sliding window rate limiter for all IPC operations ([f7431b0](https://github.com/browse4extract/browse4extract/commit/f7431b0))
* **file validation:** add dangerous file extension blacklist for profile loading ([f7431b0](https://github.com/browse4extract/browse4extract/commit/f7431b0))
* **session expiry:** automatic detection and filtering of expired session cookies ([f7431b0](https://github.com/browse4extract/browse4extract/commit/f7431b0))
* **security audit:** all medium and low priority recommendations implemented ([f7431b0](https://github.com/browse4extract/browse4extract/commit/f7431b0))

**Security Rating Upgraded: B+ → A (Excellent)**

### Documentation

* add comprehensive documentation system with architecture, security, and development guides ([91baec5](https://github.com/browse4extract/browse4extract/commit/91baec5bc9f8bdc56413c97b084380b7394a1fb0))
* update security documentation with all fixes and new enhancements ([e104326](https://github.com/browse4extract/browse4extract/commit/e104326bd91d719ce66ab7c009e81a4b2e2bed68))

### [1.1.1](https://github.com/browse4extract/browse4extract/compare/v1.1.0...v1.1.1) (2025-11-12)


### Bug Fixes

* security improvements - XSS prevention and SSRF protection ([3bf5f6a](https://github.com/browse4extract/browse4extract/commit/3bf5f6a4d3e2169b074f548460bc6452a2c68c90))

## 1.1.0 (2025-11-12)


### Features

* Implement custom frameless window with title bar and modal ([20de286](https://github.com/browse4extract/browse4extract/commit/20de2864959cb0dcafc815ad947360d2666d477d))
* Move status display to title bar ([acd19d5](https://github.com/browse4extract/browse4extract/commit/acd19d5032827f6c5e2d5cc239746a857efa76ee))
* Reorganize settings modal with categories and improved contrast ([1c65ddd](https://github.com/browse4extract/browse4extract/commit/1c65ddddc1909d5b7874a4e5821b1b3b5021b5a5)), closes [#2a2a2](https://github.com/browse4extract/browse4extract/issues/2a2a2)


### Bug Fixes

* Update GitHub Actions to latest versions ([b018dd1](https://github.com/browse4extract/browse4extract/commit/b018dd16755d23fa3f1d97c9bdfbb3c0c5444de9))


### Code Refactoring

* Move status from title bar to navigation bar ([9f89e38](https://github.com/browse4extract/browse4extract/commit/9f89e3876107d2acd160526df09c2aec59da3f5d))

# Changelog

All notable changes to Browse4Extract will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
