import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { NotificationEmail } from "../templates/transactional/notification";
import { NotificationDigestEmail } from "../templates/transactional/notification-digest";
import { WaitlistConfirmationEmail } from "../templates/transactional/waitlist-confirmation";

describe("Email Templates", () => {
  describe("NotificationEmail", () => {
    it("renders correctly with full props", async () => {
      const props = {
        name: "David",
        title: "Test Notification",
        message: "This is a test message.",
        action: {
          label: "Click Me",
          url: "https://stackmatch.com/test",
        },
      };

      const html = await render(<NotificationEmail {...props} />);

      expect(html).toContain("Hi");
      expect(html).toContain("David");
      expect(html).toContain("Test Notification");
      expect(html).toContain("This is a test message.");
      expect(html).toContain("Click Me");
      expect(html).toContain('href="https://stackmatch.com/test"');
    });

    it("renders without action button if not provided", async () => {
      const props = {
        name: "David",
        title: "Simple Notification",
        message: "No action here.",
      };

      const html = await render(<NotificationEmail {...props} />);

      expect(html).toContain("Hi");
      expect(html).toContain("David");
      expect(html).not.toContain("Click Me");
    });

    it("renders the star-back messaging unlock copy", async () => {
      const html = await render(
        <NotificationEmail
          name="David"
          title="You received a new star"
          message="@octocat starred your profile this week. Star them back to unlock messaging."
          action={{
            label: "View profile",
            url: "https://stackmatch.com/octocat",
          }}
        />
      );

      expect(html).toContain(
        "@octocat starred your profile this week. Star them back to unlock messaging."
      );
    });
  });

  describe("NotificationDigestEmail", () => {
    it("renders mutual star messaging unlock copy in digest items", async () => {
      const html = await render(
        <NotificationDigestEmail
          name="David"
          title="You have 1 new notification on StackMatch"
          count={1}
          items={[
            "You received a new star: You and @octocat starred each other this week. You can message them now.",
          ]}
          action={{
            label: "Open notifications",
            url: "https://stackmatch.com/notifications",
          }}
        />
      );

      expect(html).toContain(
        "You and @octocat starred each other this week. You can message them now."
      );
      expect(html).toContain("Open notifications");
    });
  });

  describe("WaitlistConfirmationEmail", () => {
    it("uses ticket modal and canonical referral URLs", async () => {
      const html = await render(
        <WaitlistConfirmationEmail
          githubHandle="thedaviddias"
          memberNumber={1}
          referralCode="O5P8QH"
        />
      );

      expect(html).toContain('href="https://stackmatch.dev/waitlist?ref=O5P8QH&amp;ticket=1"');
      expect(html).toContain("https://stackmatch.dev/r/O5P8QH");
      expect(html).not.toContain("view=ticket");
    });
  });
});
