'use client'

import { useState } from 'react'
import Link from 'next/link'
import { businessStories, edition, marketForStory, markets, stories, type Section, type Story } from '@/lib/bilyonaryo/content'
import { Arrow, ConceptLabel, HulaWordmark, NewsHeader, PreviewFooter } from './ui'

function OddsChip({ story }: { story: Story }) {
  const market = marketForStory(story)
  return <span className="by-odds-chip"><span className="by-status-dot" /><strong>{market.yes}%</strong> {market.chip}<Arrow /></span>
}

function FeaturedStory({ story, lead }: { story: Story; lead?: boolean }) {
  return <article className={lead ? 'by-lead' : 'by-sports-story'}>
    <Link href={`/bilyonaryo/story/${story.id}`} className="by-story-link">
      <div className="by-story-eyebrow"><span className="by-section-label">{story.section}</span><span className="by-source">{story.source} <span>·</span> 19 NOV</span></div>
      <h2>{story.headline}</h2>
      <p>{story.standfirst}</p>
      <div className="by-story-bottom"><OddsChip story={story} /><span className="by-mono by-predict-hint">MAKE YOUR CALL</span></div>
    </Link>
  </article>
}

export function NewsFeed({ initialSection = 'Top' }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection)

  return <div className="by-shell">
    <ConceptLabel />
    <div className="by-paper">
      <NewsHeader onHome={() => setSection('Top')} />
      <div className="by-date-row"><time dateTime="2026-11-19">{edition}</time><span>THE DAILY BRIEF</span></div>
      <nav className="by-tabs" aria-label="News sections">
        {(['Top', 'Politics', 'Business', 'Sports'] as Section[]).map((tab) => <button type="button" key={tab} aria-pressed={section === tab} onClick={() => setSection(tab)}>{tab}{tab === 'Top' && <span className="by-tab-dot" />}</button>)}
      </nav>
      <div className="by-ticker" aria-label="Illustrative prediction odds">
        <span className="by-ticker-label"><span className="by-status-dot" />THE OUTLOOK</span>
        <div className="by-ticker-items">{markets.map((market) => <Link key={market.id} href={`/bilyonaryo/story/${market.id}`}><span>{market.section === 'Politics' ? 'Senate conviction' : 'Eala to the QF'}</span><strong>{market.yes}%</strong><Arrow /></Link>)}</div>
        <span className="by-ticker-note">ILLUSTRATIVE</span>
      </div>
      <main id="news" className="by-feed" aria-label={`${section} news`}>
        <div className="by-feed-heading"><h1>{section === 'Top' ? 'The big picture' : section}</h1><span className="by-mono">19.11.26</span></div>
        {(section === 'Top' || section === 'Politics') && <FeaturedStory story={stories[0]} lead />}
        {section === 'Top' && <aside className="by-explainer"><span className="by-explainer-mark">h<span>.</span></span><div><strong>The story doesn’t end at the headline.</strong><p>See the odds. Take a view. Follow what happens.</p></div></aside>}
        {(section === 'Top' || section === 'Sports') && <FeaturedStory story={stories[1]} lead={section === 'Sports'} />}
        {(section === 'Top' || section === 'Business') && <section className="by-business" aria-labelledby="business-heading">
          <div className="by-business-heading"><h2 id="business-heading">The business brief</h2><span className="by-mono">FROM BILYONARYO</span></div>
          {businessStories.map((story, index) => <a className="by-business-story" href={story.url} key={story.url} target="_blank" rel="noopener noreferrer"><span className="by-story-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{story.headline}</h3><span className="by-business-source">Bilyonaryo <span>·</span> {story.date}</span></div><Arrow diagonal /></a>)}
        </section>}
        <div className="by-endnote"><span /><span className="by-mono">YOU’RE IN THE KNOW.</span><span /></div>
        <div className="by-powered">A little perspective, powered by <HulaWordmark /></div>
      </main>
      <PreviewFooter />
    </div>
  </div>
}
