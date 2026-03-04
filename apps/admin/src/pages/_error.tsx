import type { NextPageContext } from 'next'

/**
 * Custom Pages Router error page.
 * In App Router projects, errors are handled by app/global-error.tsx and app/not-found.tsx.
 * This file exists solely to prevent prerender errors during static generation of /404 and /500.
 */
function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>{statusCode || 'Error'}</h1>
      <p>{statusCode === 404 ? 'Page not found' : 'An error occurred'}</p>
    </div>
  )
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default ErrorPage
