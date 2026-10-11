import { escapeHtml } from './html.util';

describe('escapeHtml', () => {
  it('neutralises markup and attribute breakouts', () => {
    expect(escapeHtml(`<script>alert("x")</script>'&`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#39;&amp;',
    );
  });
});
