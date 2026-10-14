import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import { EmptyState } from '../components/common/EmptyState.js';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-xl mx-auto py-16 px-4">
      <div className="bg-card border border-border rounded-xl p-8 shadow-sm text-center">
        <EmptyState
          icon={<FileQuestion size={40} className="text-muted-foreground" />}
          title="404 — Resource Not Found"
          description="The tender dossier, compliance item, or settings route you requested does not exist or has been moved."
          action={
            <Link to="/bids" className="no-underline">
              <Button variant="default" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Return to Bid Dashboard
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );
};
