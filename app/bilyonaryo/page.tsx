import { NewsFeed } from './news-feed'
import type { Section } from '@/lib/bilyonaryo/content'

export default function BilyonaryoPage({ searchParams }: { searchParams: { section?: string } }) {
  const sections: Section[] = ['Politics', 'Business', 'Sports']
  const initialSection = sections.find((section) => section.toLowerCase() === searchParams.section) || 'Top'
  return <NewsFeed key={searchParams.section || 'top'} initialSection={initialSection} />
}
