import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useGetRateLimit, getGetRateLimitQueryKey } from '@workspace/api-client-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function RateLimitBadge() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGetRateLimit({
    query: { refetchInterval: 1000 * 60 * 5 },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetRateLimitQueryKey() });
  };

  if (isLoading) {
    return (
      <span className="text-[10px] font-mono text-zinc-700 animate-pulse">--/--</span>
    );
  }

  if (isError || !data) {
    return (
      <button onClick={handleRefresh} className="flex items-center gap-1 text-[10px] font-mono text-red-600 hover:text-red-400 transition-colors">
        <AlertTriangle className="w-3 h-3" />
        limit
      </button>
    );
  }

  const percentage = (data.remaining / data.limit) * 100;
  const isLow = percentage < 20;
  const resetDate = new Date(data.reset * 1000);
  const timeStr = resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleRefresh}
          className={`text-[10px] font-mono transition-colors ${
            isLow ? 'text-red-500 hover:text-red-300' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          {data.remaining}/{data.limit}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px] font-mono">
        GitHub API resets at {timeStr}
      </TooltipContent>
    </Tooltip>
  );
}
