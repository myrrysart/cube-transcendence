import privacy from '../../../docs/privacy-policy.md?raw'
import terms from '../../../docs/terms-of-service.md?raw'

export function LegalPage({ page }: { readonly page: 'privacy' | 'terms' }) {
  const content = page === 'privacy' ? privacy : terms
  const blocks = content.replace(/<!--[\s\S]*?-->/g, '').trim().split(/\n\s*\n/)

  return <main className="legal-page">
    <a href="/">← Back to the game</a>
    <article aria-label={page === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}>
      {blocks.map((block, index) => {
        if (block.startsWith('# ')) return <h1 key={index}>{block.slice(2)}</h1>
        if (block.startsWith('## ')) return <h2 key={index}>{block.slice(3)}</h2>
        if (block.startsWith('- ')) return <ul key={index}>{block.split('\n').map((item, itemIndex) => <li key={itemIndex}>{item.slice(2)}</li>)}</ul>
        return <p key={index}>{block.replace(/\n/g, ' ')}</p>
      })}
    </article>
  </main>
}
