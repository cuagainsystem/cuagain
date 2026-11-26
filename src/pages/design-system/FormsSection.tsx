import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, Mail, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/common/Button';
import { SelectField } from '../../components/forms/SelectField';
import { TextAreaField } from '../../components/forms/TextAreaField';
import { TextField } from '../../components/forms/TextField';
import { CATEGORY_SLUGS, ITEM_CATEGORIES } from '../../utils/categories';
import { Section } from './Section';
import styles from './DesignSystemPage.module.css';

const categoryOptions = CATEGORY_SLUGS.map((slug) => ({ value: slug, label: ITEM_CATEGORIES[slug].label }));

const sampleReportSchema = z.object({
  itemName: z.string().trim().min(3, 'Enter at least 3 characters.'),
  category: z.string().min(1, 'Choose a category.'),
  description: z.string().trim().min(10, 'Describe the item in at least 10 characters.'),
});

type SampleReportValues = z.infer<typeof sampleReportSchema>;

/*
  This demo form proves that react-hook-form, zod and our field components
  work together. Phase 2 and 4 reuse the same pattern for real forms.
  Nothing here is saved anywhere.
*/
function SampleReportForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitSuccessful },
  } = useForm<SampleReportValues>({
    resolver: zodResolver(sampleReportSchema),
    defaultValues: { itemName: '', category: '', description: '' },
  });

  return (
    <form className={styles.formDemo} onSubmit={handleSubmit(() => undefined)} noValidate>
      <TextField
        label="Item name"
        placeholder="For example: Black umbrella"
        required
        error={errors.itemName?.message}
        {...register('itemName')}
      />
      <SelectField
        label="Category"
        placeholder="Choose a category"
        options={categoryOptions}
        required
        error={errors.category?.message}
        {...register('category')}
      />
      <TextAreaField
        label="Description"
        hint="Mention colour, brand and any marks that identify it."
        required
        error={errors.description?.message}
        {...register('description')}
      />

      <div className={styles.row}>
        <Button type="submit">Check form</Button>
        <Button variant="ghost" onClick={() => reset()}>
          Reset
        </Button>
      </div>

      {isSubmitSuccessful ? (
        <p className={styles.formSuccess} role="status">
          <CircleCheck aria-hidden="true" />
          Valid. Nothing is saved in this demo.
        </p>
      ) : null}
    </form>
  );
}

export function FormsSection() {
  return (
    <Section
      id="forms"
      title="Form fields"
      description="Fields sit in a soft inset well. Every field has a visible label, optional hint text, and an error message that is announced to screen readers."
    >
      <div className={styles.group}>
        <h3 className={styles.subheading}>States</h3>
        <div className={styles.fieldGrid}>
          <TextField label="Search items" placeholder="Umbrella, charger, ID..." icon={Search} />
          <TextField label="School email" type="email" placeholder="1234567@g.cu.edu.ph" icon={Mail} hint="Use your school email address." />
          <TextField label="Student ID" defaultValue="12345" error="Student ID must be exactly seven digits." />
          <TextField label="Password" type="password" defaultValue="example-password" />
          <TextField label="Locked field" defaultValue="Cannot be edited" disabled />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>Validated form</h3>
        <SampleReportForm />
      </div>
    </Section>
  );
}
