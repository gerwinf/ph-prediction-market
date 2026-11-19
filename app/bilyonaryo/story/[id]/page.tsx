import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { marketForStory, stories } from '@/lib/bilyonaryo/content'
import { Arrow, ConceptLabel, NewsHeader, PreviewFooter } from '../../ui'
import { PredictionWidget } from '../../prediction-widget'

export function generateStaticParams() {
  return stories.map((story) => ({ id: story.id }))
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const story = stories.find((item) => item.id === params.id)
  return { title: story ? `${story.headline} — Concept preview` : 'Story not found' }
}

export default function StoryPage({ params }: { params: { id: string } }) {
  const story = stories.find((item) => item.id === params.id)
  if (!story) notFound()
  const market = marketForStory(story)

  return <div className="by-shell">
    <ConceptLabel />
    <div className="by-paper">
      <NewsHeader compact />
      <main className="by-article">
        <Link className="by-back" href="/bilyonaryo"><span aria-hidden="true">←</span> Back to the brief</Link>
        <div className="by-story-eyebrow"><span className="by-section-label">{story.section}</span><span className="by-source">{story.source}</span></div>
        <h1>{story.headline}</h1>
        <p className="by-standfirst">{story.standfirst}</p>
        <div className="by-article-byline"><span>Reporting by <strong>{story.credit}</strong> via <strong>{story.source}</strong></span><time dateTime={story.dateISO}>{story.date}</time></div>
        <a className="by-original-link" href={story.url} target="_blank" rel="noopener noreferrer">{story.url.includes('?s=') ? 'Find the full story' : 'Read the full story'} on {story.source}<Arrow diagonal /></a>
        <div className="by-article-divider"><span>WHAT HAPPENS NEXT?</span></div>
        <PredictionWidget market={market} />
        <p className="by-editorial-note">The story is on {story.source}. The prediction is yours.<br />Markets and resolution are handled by Hula.</p>
      </main>
      <PreviewFooter />
    </div>
  </div>
}
