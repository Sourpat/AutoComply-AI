/**
 * GitHub API Helper Functions
 * 
 * Provides read/write access to repository files via GitHub Contents API
 */

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const owner = process.env.GITHUB_OWNER || 'Sourpat';
const repo = process.env.GITHUB_REPO || 'AutoComply-AI-fresh';
const branch = process.env.GITHUB_BRANCH || 'main';

interface FileContent {
  content: string;
  sha: string;
  path: string;
}

/**
 * Get file content from GitHub repository
 * 
 * @param path - File path relative to repo root (e.g., "TASK_QUEUE.md")
 * @returns Decoded file content and SHA for updates
 */
export async function getFile(path: string): Promise<FileContent> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (!('content' in data)) {
      throw new Error(`Path ${path} is not a file`);
    }

    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return {
      content,
      sha: data.sha,
      path: data.path,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      throw new Error(`File not found: ${path}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get file ${path}: ${message}`);
  }
}

/**
 * Update or create file in GitHub repository
 * 
 * @param path - File path relative to repo root
 * @param content - New file content (plain text)
 * @param message - Commit message
 * @param sha - Current file SHA (required for updates, omit for creates)
 * @returns Commit SHA
 */
export async function updateFile(
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<string> {
  try {
    const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: contentBase64,
      branch,
      ...(sha && { sha }),
    });

    return data.commit.sha || '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update file ${path}: ${message}`);
  }
}

/**
 * Append content to existing file
 * 
 * @param path - File path relative to repo root
 * @param appendContent - Content to append (will add newlines as needed)
 * @param message - Commit message
 * @returns Commit SHA
 */
export async function appendToFile(
  path: string,
  appendContent: string,
  message: string
): Promise<string> {
  const { content, sha } = await getFile(path);
  
  // Ensure proper newline separation
  const separator = content.endsWith('\n') ? '' : '\n';
  const newContent = content + separator + appendContent + '\n';

  return updateFile(path, newContent, message, sha);
}
