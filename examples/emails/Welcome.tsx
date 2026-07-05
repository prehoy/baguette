import { Body, Container, Head, Heading, Html, Text } from "@react-email/components";

// A template is a React component + optional `preview` sample props (used by the
// /api/emails preview endpoint). Fetch data in your handler, pass it as props.
export default function Welcome({ name }: { name: string }) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif", background: "#fafafa" }}>
        <Container style={{ padding: "24px" }}>
          <Heading>Welcome, {name} 🥖</Heading>
          <Text>Thanks for trying baguette. Drop a file, get an endpoint.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const preview = { name: "Ada" };
