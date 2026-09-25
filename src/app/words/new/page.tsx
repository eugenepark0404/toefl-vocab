import WordForm from '@/components/WordForm';

export default function NewWordPage() {
  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>단어 등록</h1>
      <WordForm />
    </div>
  );
}
