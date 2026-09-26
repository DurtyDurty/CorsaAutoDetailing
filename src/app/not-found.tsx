import { Container } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container className="py-24 max-w-xl">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep">404</p>
      <h1 className="font-display text-4xl mt-3">That page isn&rsquo;t here.</h1>
      <p className="mt-4 text-ink-muted">The link may be old or mistyped.</p>
      <div className="mt-8">
        <ButtonLink href="/">Back to home</ButtonLink>
      </div>
    </Container>
  );
}
