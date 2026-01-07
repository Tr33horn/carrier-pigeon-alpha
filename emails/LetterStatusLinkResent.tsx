import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { APP_URL } from "@/app/lib/email/config";
import { EmailLayout } from "./components/Layout";
import { joinUrl, styles } from "./components/utils";

export function LetterStatusLinkResentEmail({
  subject,
  originName,
  destName,
  statusUrl,
}: {
  subject: string;
  originName: string;
  destName: string;
  statusUrl: string; // path or full URL
}) {
  const href = joinUrl(APP_URL, statusUrl);

  return (
    <EmailLayout preview="Your flight status link — track your letter.">
      <Text style={styles.h1}>Your status link</Text>

      <Text style={styles.p}>
        Here’s the tracking link you requested.
      </Text>

      <Text style={styles.pill}>
        Route: <strong>{originName}</strong> → <strong>{destName}</strong>
      </Text>

      <Text style={{ ...styles.subtle, marginBottom: 0 }}>
        <strong>{subject}</strong>
      </Text>

      <Section style={{ marginTop: 12 }}>
        <Button href={href} style={styles.button}>
          View flight status
        </Button>
      </Section>

      <Text style={styles.small}>
        If you didn’t request this, you can ignore it.
      </Text>
    </EmailLayout>
  );
}