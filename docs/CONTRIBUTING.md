# Contributing to Browse4Extract

First off, thank you for considering contributing to Browse4Extract! It's people like you that make Browse4Extract such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed and what behavior you expected**
* **Include screenshots if relevant**
* **Include your environment details** (OS, Node version, Electron version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a detailed description of the suggested enhancement**
* **Explain why this enhancement would be useful**
* **List some examples of how it would be used**

### Pull Requests

* Fill in the required template
* Follow the TypeScript styleguide
* Include screenshots in your pull request whenever possible
* Document new code
* End all files with a newline

## Development Setup

### Prerequisites

- Node.js 18+
- npm
- Git

### Getting Started

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/Browse4Extract.git
cd Browse4Extract

# Install dependencies
npm install

# Run in development mode
npm run dev

# In another terminal, start the app
npm start
```

### Project Structure

```
Browse4Extract/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React UI
│   ├── preload/        # Preload scripts
│   └── types/          # TypeScript types
├── assets/             # Icons and images
└── dist/              # Compiled output
```

### Coding Standards

#### TypeScript

* Use TypeScript for all new code
* Add types for function parameters and return values
* Avoid `any` type when possible
* Use interfaces for object shapes

#### React

* Use functional components with hooks
* Keep components small and focused
* Use TypeScript for props

#### Code Style

* Use 2 spaces for indentation
* Use single quotes for strings
* Add semicolons
* Use descriptive variable names
* Comment complex logic

### Testing

```bash
# Run tests (when available)
npm test

# Build to check for errors
npm run build
```

### Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters
* Reference issues and pull requests after the first line

Examples:
```
Add visual element picker for easier selection

Fix memory leak in scraper when handling large datasets

Update README with installation instructions
Closes #123
```

## Pull Request Process

1. **Update documentation** - Update the README.md with details of changes if needed
2. **Update CHANGELOG.md** - Add your changes to the Unreleased section
3. **Test thoroughly** - Make sure your changes don't break existing functionality
4. **One feature per PR** - Keep pull requests focused on a single feature/fix
5. **Clean commit history** - Squash commits if needed

## Release Process

Releases are managed by the maintainers. Version numbers follow [Semantic Versioning](https://semver.org/):

* MAJOR version for incompatible API changes
* MINOR version for new functionality in a backwards-compatible manner
* PATCH version for backwards-compatible bug fixes

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

## Attribution

This Contributing Guide is adapted from the [Open Source Guides](https://opensource.guide/).

Thank you for your contributions! 🎉
