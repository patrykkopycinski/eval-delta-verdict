import LoginForm from './form';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="card" style={{ maxWidth: 420, margin: '60px auto' }}>
      <h1>Sign in</h1>
      <p className="mut">Eval Delta Verdict — team access.</p>
      <LoginForm next={next ?? '/'} />
    </div>
  );
}
