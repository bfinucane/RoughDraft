import React from 'react';
import {
  AppWindow,
  ArrowRight,
  CheckSquare,
  ChevronDownSquare,
  CircleUserRound,
  Columns3,
  CreditCard,
  FormInput,
  Heading,
  Image as ImageIcon,
  LayoutPanelTop,
  MessageSquareWarning,
  Minus,
  MousePointerClick,
  Search,
  Smartphone,
  Square,
  StickyNote,
  Table2,
  Text,
} from 'lucide-react';
import { WidgetType } from '../types/wireframe';

export const StencilIcon: React.FC<{ type: WidgetType; className?: string }> = ({
  type,
  className = 'h-4 w-4',
}) => {
  switch (type) {
    case 'browser':
      return <AppWindow className={className} />;
    case 'mobile':
      return <Smartphone className={className} />;
    case 'box':
      return <Square className={className} />;
    case 'modal':
      return <CreditCard className={className} />;
    case 'button':
      return <MousePointerClick className={className} />;
    case 'input':
      return <FormInput className={className} />;
    case 'search':
      return <Search className={className} />;
    case 'select':
      return <ChevronDownSquare className={className} />;
    case 'checkbox':
      return <CheckSquare className={className} />;
    case 'tabs':
      return <Columns3 className={className} />;
    case 'navbar':
      return <LayoutPanelTop className={className} />;
    case 'heading':
      return <Heading className={className} />;
    case 'paragraph':
      return <Text className={className} />;
    case 'image':
      return <ImageIcon className={className} />;
    case 'avatar':
      return <CircleUserRound className={className} />;
    case 'table':
      return <Table2 className={className} />;
    case 'divider':
      return <Minus className={className} />;
    case 'arrow':
      return <ArrowRight className={className} />;
    case 'note':
      return <StickyNote className={className} />;
    case 'callout':
      return <MessageSquareWarning className={className} />;
    default:
      return <Square className={className} />;
  }
};
