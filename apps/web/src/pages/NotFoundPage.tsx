import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '../components/common/Button.js';
import { EmptyState } from '../components/common/EmptyState.js';

export const NotFoundPage: React.FC = () => {
  return (
    <div style={{ padding: '4rem 1rem', maxWidth: '600px', margin: '0 auto' }}>
      <EmptyState
        icon={<FileQuestion size={36} className="text-muted-foreground" />}
        title="404 — Page Not Found"
        description="The page or resource you requested does not exist or has been moved."
        action={
          <Link to="/bids">
            <Button variant="primary">Return to Bids Dashboard</Button>
          </Link>
        }
      />
    </div>
  );
};
