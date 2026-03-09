import { PostDetail } from '@/components/PostDetail';

export default function PostPage({ params }: { params: { id: string } }) {
  return <PostDetail id={params.id} />;
}
