import { describe, expect, test } from 'bun:test';
import { stripLeadingHtmlCommentBlocks } from './SkillRegistry';

describe('stripLeadingHtmlCommentBlocks', () => {
  test('strips a generated comment banner before frontmatter', () => {
    const input = `<!--\nGenerated banner\n-->\n---\nname: demo\ndescription: A sufficiently long demo description.\n---\n# Skill`;

    const output = stripLeadingHtmlCommentBlocks(input);

    expect(output.startsWith('---\nname: demo')).toBe(true);
  });

  test('strips multiple leading comment blocks', () => {
    const input = `<!-- one -->\n\n<!-- two -->\n---\nname: demo\ndescription: A sufficiently long demo description.\n---`;

    const output = stripLeadingHtmlCommentBlocks(input);

    expect(output.startsWith('---\nname: demo')).toBe(true);
  });

  test('removes UTF-8 BOM before frontmatter', () => {
    const input = `\uFEFF---\nname: demo\ndescription: A sufficiently long demo description.\n---`;

    const output = stripLeadingHtmlCommentBlocks(input);

    expect(output.startsWith('---\nname: demo')).toBe(true);
  });

  test('does not alter non-comment leading content', () => {
    const input = `# Intro\n---\nname: demo\ndescription: A sufficiently long demo description.\n---`;

    const output = stripLeadingHtmlCommentBlocks(input);

    expect(output).toBe(input);
  });
});
