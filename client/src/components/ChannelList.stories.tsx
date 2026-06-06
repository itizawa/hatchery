import type { Meta, StoryObj } from "@storybook/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { ChannelList } from "./ChannelList";

const meta = {
  title: "components/ChannelList",
  component: ChannelList,
  decorators: [
    (Story) => {
      const rootRoute = createRootRoute({ component: () => <Story /> });
      const channelRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: "/channels/$channelId",
        component: () => null,
      });
      const router = createRouter({
        routeTree: rootRoute.addChildren([channelRoute]),
        history: createMemoryHistory({ initialEntries: ["/"] }),
      });
      return <RouterProvider router={router} />;
    },
  ],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ChannelList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
