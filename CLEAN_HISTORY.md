# Cleaning Git History to Remove API Keys

This guide explains how to remove sensitive information like API keys from your Git history using the BFG Repo Cleaner.

## Prerequisites

1. Download the BFG Repo Cleaner from https://rtyley.github.io/bfg-repo-cleaner/
2. Java Runtime Environment (JRE)

## Steps to Clean the Repository

1. Create a backup of your repository before proceeding.

2. Create a text file named `sensitive-data.txt` with the API keys to be removed:

```
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
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
```

3. Run the BFG command to remove the sensitive data from the Git history:

```bash
java -jar bfg.jar --replace-text sensitive-data.txt /path/to/your/repo.git
```

4. Enter your repository directory and run these commands to clean and update the repository:

```bash
cd /path/to/your/repo
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

5. Force push the cleaned repository to GitHub:

```bash
git push --force
```

## Notes

- Make sure you have replaced all hardcoded API keys with environment variables before pushing.
- After cleaning the history, change your API keys as the old ones have been compromised.
- Always use environment variables for sensitive information in the future.
- Add .env files to your .gitignore file to prevent accidentally committing sensitive data.

## Alternative Using Git Filter-Branch

If you don't want to use BFG, you can use Git's built-in filter-branch command:

```bash
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch proxy-server/server.js setup_vocabulary_system.sql src/pages/teacher/EditQuestion.tsx" --prune-empty --tag-name-filter cat -- --all
```

Then edit the files to remove the sensitive data, commit the changes, and force push:

```bash
git push --force
``` 