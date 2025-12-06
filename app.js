import { useState, useMemo, useEffect } from "react";
import {
  MagnifyingGlassIcon,
  ClockIcon,
  BanknotesIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  UserIcon,
  PhoneIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import {
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import OrderDrawer from "../components/OrderDrawer";
import Modal from "../../../components/ui/Modal";
import {
  useGetOrdersQuery,
  useUpdateOrderStatusMutation,
  useUpdatePaymentStatusMutation,
  useConfirmPaymentMutation,
} from "../../../api/ordersApi";
import { useSocket } from "../../../app/providers/SocketProvider";

// --- Types & Mock Data Schema ---

export type OrderStatus =
  | "incoming"
  | "kitchen"
  | "ready"
  | "delivery"
  | "completed"
  | "cancelled";

export type PaymentStatus = "paid" | "pending" | "refunded";

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: string[];
  notes?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerMobile?: string;
  tableNo?: string;
  orderType: "dine-in" | "takeaway" | "delivery";
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "cash" | "card" | "online";
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
  notes?: string;
  kotStatus: "none" | "sent" | "acknowledged";
}

// --- Mock Analytics Data ---
const HOURLY_DATA = [
  { time: "10am", sales: 1200 },
  { time: "11am", sales: 2400 },
  { time: "12pm", sales: 4500 },
  { time: "1pm", sales: 5800 },
  { time: "2pm", sales: 3200 },
  { time: "3pm", sales: 1800 },
];

// --- Components ---

const getOrderColor = (status: OrderStatus) => {
  switch (status) {
    case "incoming":
      return "bg-amber-400"; // Yellow
    case "kitchen":
      return "bg-blue-500"; // Blue
    case "ready":
      return "bg-purple-500"; // Purple
    case "delivery":
      return "bg-emerald-500"; // Green
    default:
      return "bg-slate-500";
  }
};

const getTimeAgo = (date: Date) => {
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 60) return `${diff} minutes ago`;
  const hours = Math.floor(diff / 60);
  return `${hours} hours ago`;
};

const OrderCard = ({
  order,
  onClick,
  onPay,
  onServe,
}: {
  order: Order;
  onClick: () => void;
  onPay: (e: React.MouseEvent) => void;
  onServe: (e: React.MouseEvent) => void;
}) => {
  const headerColor = getOrderColor(order.status);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col h-full border border-slate-100"
    >
      {/* Colored Header */}
      <div className={`${headerColor} p-4 text-white`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            <span className="font-bold text-lg">{order.customerName}</span>
          </div>
          {order.status === "incoming" && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
              New
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 text-sm font-medium opacity-90">
          <div className="flex items-center gap-2">
            {order.tableNo && <span>Table: {order.tableNo}</span>}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <ClockIcon className="w-4 h-4" />
            {getTimeAgo(order.createdAt)}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Contact Info */}
        {order.customerMobile && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pb-2 border-b border-slate-100">
            <PhoneIcon className="w-3 h-3" />
            {order.customerMobile}
          </div>
        )}

        {/* Items */}
        <div className="space-y-3 flex-1">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                {/* Placeholder for item image */}
                <img
                  src={`https://source.unsplash.com/random/100x100/?food,${item.name}`}
                  alt={item.name}
                  className="w-full h-full object-cover opacity-80"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">
                    {item.name}
                  </span>
                  <span className="text-emerald-600 font-bold text-sm">
                    x{item.quantity}
                  </span>
                </div>
                {item.modifiers && (
                  <div className="text-xs text-slate-400">
                    {item.modifiers.join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: Total & Action */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
          <div>
            <div className="text-xs text-slate-400 font-medium">
              Total Amount
            </div>
            <div className="text-xl font-black text-slate-900">
              ₹{order.total.toFixed(2)}
            </div>
          </div>

          {order.paymentStatus === "pending" && order.status === "incoming" ? (
            <button
              onClick={onPay}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-600 hover:scale-105 transition-all flex items-center gap-2"
            >
              <BanknotesIcon className="w-4 h-4" />
              Pay
            </button>
          ) : order.status === "ready" ? (
            <button
              onClick={onServe}
              className="px-4 py-2 bg-blue-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-600 hover:scale-105 transition-all flex items-center gap-2"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Serve
            </button>
          ) : order.paymentStatus === "paid" ? (
            <div className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg font-bold text-xs flex items-center gap-1">
              <CheckCircleIcon className="w-4 h-4" />
              Paid
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default function OrderRail() {
  // Fetch orders from server
  const {
    data: apiOrders = [],
    isLoading,
    refetch,
  } = useGetOrdersQuery({ status: "PENDING,KITCHEN,READY" });
  const [updateOrderStatus] = useUpdateOrderStatusMutation();
  const [updatePaymentStatus] = useUpdatePaymentStatusMutation();
  const [confirmPayment] = useConfirmPaymentMutation();
  const { socket } = useSocket();

  const [filterStatus, setFilterStatus] = useState<OrderStatus>("incoming");
  console.log(filterStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card">(
    "cash"
  );

  // Map API orders to component Order format
  const orders = useMemo(() => {
    return apiOrders.map(
      (apiOrder): Order => ({
        id: apiOrder.id,
        customerName: apiOrder.customer?.name || "Guest",
        customerMobile: apiOrder.customer?.phone || undefined,
        tableNo: apiOrder.tableNo || undefined,
        orderType: apiOrder.type as "dine-in" | "takeaway" | "delivery",
        status:
          apiOrder.status.toLowerCase() === "pending"
            ? "incoming"
            : (apiOrder.status.toLowerCase() as OrderStatus),
        paymentStatus: apiOrder.paymentStatus.toLowerCase() as PaymentStatus,
        paymentMethod: (apiOrder.paymentMethod || "cash") as
          | "cash"
          | "card"
          | "online",
        items: apiOrder.items.map((item) => ({
          id: item.id,
          name: item.menuItem?.name || "Unknown Item",
          quantity: item.quantity,
          price: item.price,
          modifiers: [],
          notes: item.notes || undefined,
        })),
        subtotal: apiOrder.totalAmount,
        tax: apiOrder.taxAmount,
        total: apiOrder.finalAmount,
        createdAt: new Date(apiOrder.createdAt),
        notes: undefined,
        kotStatus: "none",
      })
    );
  }, [apiOrders]);

  // Listen for real-time order updates via Socket.IO
  useEffect(() => {
    if (!socket.isConnected()) {
      console.log("⚠️ Socket not connected - Admin Order Rail");
      return;
    }

    console.log("✅ Setting up socket listeners - Admin Order Rail");

    // Listen for new orders
    const handleOrderCreated = (order: any) => {
      console.log(
        "🔔 New order received via socket - Admin Order Rail:",
        order
      );
      // Refetch orders to get the latest data
      refetch();
    };

    // Listen for order status updates
    const handleOrderStatusUpdated = (order: any) => {
      console.log(
        "🔄 Order status updated via socket - Admin Order Rail:",
        order
      );
      refetch();
    };

    // Listen for order cancellations
    const handleOrderCancelled = (order: any) => {
      console.log("❌ Order cancelled via socket - Admin Order Rail:", order);
      refetch();
    };

    socket.onOrderCreated(handleOrderCreated);
    socket.onOrderStatusUpdated(handleOrderStatusUpdated);
    socket.onOrderCancelled(handleOrderCancelled);

    // Cleanup listeners on unmount
    return () => {
      console.log("🧹 Cleaning up socket listeners - Admin Order Rail");
      socket.off("order:created");
      socket.off("order:statusUpdated");
      socket.off("order:cancelled");
    };
  }, [socket, refetch]);

  // --- Actions ---

  const handleMarkPaid = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setPaymentOrder(order);
    setPaymentMode("cash"); // Default to cash
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!paymentOrder) return;

    try {
      // Map UI payment mode to backend payment method format
      const paymentMethodMap = {
        cash: "CASH",
        upi: "UPI",
        card: "CARD",
      };

      // Use the new confirmPayment mutation which handles both payment and status update
      await confirmPayment({
        id: paymentOrder.id,
        paymentMethod: paymentMethodMap[paymentMode],
      }).unwrap();

      setIsPaymentModalOpen(false);
      setPaymentOrder(null);
    } catch (error) {
      console.error("Failed to update payment:", error);
    }
  };

  const handleServeOrder = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    try {
      await updateOrderStatus({
        id: order.id,
        status: "COMPLETED",
      }).unwrap();
    } catch (error) {
      console.error("Failed to serve order:", error);
    }
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setIsDrawerOpen(true);
  };

  // --- Derived State ---

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = order.status === filterStatus;
      const matchesSearch =
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [orders, filterStatus, searchQuery]);

  const stats = {
    incoming: orders.filter((o) => o.status === "incoming").length,
    kitchen: orders.filter((o) => o.status === "kitchen").length,
    ready: orders.filter((o) => o.status === "ready").length,
    pendingPayment: orders.filter((o) => o.paymentStatus === "pending").length,
  };

  return (
    <div className="flex h-full bg-slate-50 font-sans overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Action Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black text-slate-800 tracking-tight">
              Order Rail
            </h1>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Updates Active
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search orders..."
                className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none w-64 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all active:scale-95">
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Rail & Stats (2/3) */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-slate-50/50">
            {/* Filters */}
            <div className="px-6 py-4 flex gap-2 border-b border-slate-200 bg-white">
              {/* Updated tab styles to increase border-radius, set active tab background to orange, and remove outline */}
              <button
                onClick={() => setFilterStatus("incoming")}
                className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  filterStatus === "incoming"
                    ? "bg-orange-500 text-white border-2 border-orange-600 shadow-sm"
                    : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
                }`}
              >
                New Orders
                {stats.incoming > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      filterStatus === "incoming"
                        ? "bg-orange-200 text-orange-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {stats.incoming}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilterStatus("kitchen")}
                className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  filterStatus === "kitchen"
                    ? "bg-orange-500 text-white border-2 border-orange-600 shadow-sm"
                    : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
                }`}
              >
                Kitchen
                {stats.kitchen > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      filterStatus === "kitchen"
                        ? "bg-orange-200 text-orange-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {stats.kitchen}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilterStatus("ready")}
                className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  filterStatus === "ready"
                    ? "bg-orange-500 text-white border-2 border-orange-600 shadow-sm"
                    : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
                }`}
              >
                Ready Orders
                {stats.ready > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      filterStatus === "ready"
                        ? "bg-orange-200 text-orange-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {stats.ready}
                  </span>
                )}
              </button>
            </div>

            {/* Order Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <ArrowPathIcon className="w-12 h-12 text-slate-400 animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">
                      Loading orders...
                    </p>
                  </div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <CheckCircleIcon className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium text-lg">
                      No {filterStatus} orders
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                      All clear for now
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => handleOrderClick(order)}
                      onPay={(e) => handleMarkPaid(e, order)}
                      onServe={(e) => handleServeOrder(e, order)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Analytics (1/3) */}
          <div className="w-[350px] bg-white border-l border-slate-200 flex flex-col overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-lg mb-4">
                Live Analytics
              </h2>

              {/* Hourly Chart */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">
                  Hourly Sales
                </h3>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={HOURLY_DATA}>
                      <defs>
                        <linearGradient
                          id="colorSales"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#FF7A00"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#FF7A00"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#FF7A00"
                        fillOpacity={1}
                        fill="url(#colorSales)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Items */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">
                  Top Selling Items
                </h3>
                <div className="space-y-3">
                  {[
                    { name: "Butter Chicken", count: 42, trend: "+12%" },
                    { name: "Garlic Naan", count: 128, trend: "+5%" },
                    { name: "Veg Burger", count: 35, trend: "-2%" },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          {i + 1}
                        </span>
                        <span className="font-medium text-slate-700">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {item.count}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            item.trend.startsWith("+")
                              ? "text-emerald-500"
                              : "text-red-500"
                          }`}
                        >
                          {item.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Cash Summary */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-6">
                <div className="flex items-center gap-2 text-amber-800 font-bold mb-1">
                  <BanknotesIcon className="w-5 h-5" />
                  Payment to be Collected
                </div>
                <div className="text-2xl font-black text-amber-600">
                  ₹1,945.50
                </div>
                <div className="text-xs text-amber-600/80 mt-1">
                  From 3 active orders
                </div>
              </div>

              {/* Refunds Summary */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">
                  Refunds Today
                </h3>
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-600">
                    Processed
                  </span>
                  <span className="font-bold text-slate-900">₹450.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Detail Drawer */}
      <OrderDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        order={selectedOrder}
        onUpdateStatus={async (status) => {
          if (selectedOrder) {
            try {
              await updateOrderStatus({
                id: selectedOrder.id,
                status,
              }).unwrap();
              setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
            } catch (error) {
              console.error("Failed to update order status:", error);
            }
          }
        }}
        onUpdatePayment={async (status) => {
          if (selectedOrder) {
            try {
              await updatePaymentStatus({
                id: selectedOrder.id,
                paymentStatus: status,
              }).unwrap();
              setSelectedOrder((prev) =>
                prev ? { ...prev, paymentStatus: status } : null
              );
            } catch (error) {
              console.error("Failed to update payment status:", error);
            }
          }
        }}
      />

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Collect Payment"
      >
        <div className="p-6">
          <div className="text-center mb-8">
            <div className="text-sm text-slate-500 font-medium mb-1">
              Total Amount to Collect
            </div>
            <div className="text-4xl font-black text-slate-900">
              ₹{paymentOrder?.total.toFixed(2)}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              Order #{paymentOrder?.id.slice(-4)} • {paymentOrder?.customerName}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => setPaymentMode("cash")}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                paymentMode === "cash"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
              }`}
            >
              <BanknotesIcon className="w-8 h-8" />
              <span className="font-bold text-sm">Cash</span>
            </button>
            <button
              onClick={() => setPaymentMode("upi")}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                paymentMode === "upi"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
              }`}
            >
              <DevicePhoneMobileIcon className="w-8 h-8" />
              <span className="font-bold text-sm">UPI</span>
            </button>
            <button
              onClick={() => setPaymentMode("card")}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                paymentMode === "card"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
              }`}
            >
              <CreditCardIcon className="w-8 h-8" />
              <span className="font-bold text-sm">Card</span>
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setIsPaymentModalOpen(false)}
              className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPayment}
              className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95"
            >
              Confirm Payment
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
