import { ChevronDown } from 'lucide-react';
import styles from './Landing.module.css';

const FAQS = [
  {
    question: 'Who can use CUAgain?',
    answer:
      'Students, staff and teachers. You create an account with your student ID and school email, then verify that email before you can sign in.',
  },
  {
    question: 'Who can see my student ID and email?',
    answer:
      'Only you and the administrators. Other users see just your username, avatar and user type.',
  },
  {
    question: 'How do I prove an item is mine?',
    answer:
      'Describe details that are not obvious from the listing, such as marks, contents or where exactly you lost it. An administrator reviews your claim before the item is handed over.',
  },
  {
    question: 'Are photos of IDs shown publicly?',
    answer:
      'No. Photos of sensitive items, such as ID cards, are hidden from public view and shown only to people who are allowed to see them.',
  },
  {
    question: 'I found something. What should I do?',
    answer:
      'Sign in and file a found report with where and when you found it and where it is being kept. Keep a detail or two out of the public description so the real owner can confirm it.',
  },
  {
    question: 'I forgot my password.',
    answer:
      'Use the "Forgot your password?" link on the sign-in page. We email a secure link that lets you choose a new password.',
  },
];

export function FaqSection() {
  return (
    <section id="faqs" className={`container ${styles.section}`} aria-labelledby="faq-heading">
      <div className={styles.faqLayout}>
        <div className={styles.header}>
          <span className="eyebrow">FAQs</span>
          <h2 id="faq-heading" className={styles.heading}>
            Questions, <em>answered.</em>
          </h2>
          <p className={styles.lead}>Can&rsquo;t find what you need? Ask the administrators at your school office.</p>
        </div>

        <div className={styles.faqList}>
          {FAQS.map(({ question, answer }) => (
            // Sharing a name makes the browser keep only one answer open at a time.
            <details key={question} name="faq" className={styles.faq}>
              <summary>
                {question}
                <ChevronDown aria-hidden="true" />
              </summary>
              <p className={styles.faqAnswer}>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
