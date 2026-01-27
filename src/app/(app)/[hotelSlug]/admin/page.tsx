import { getHotelBySlug } from "@/actions/hotels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Building2, Utensils, ShoppingBag } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ hotelSlug: string }>;
};

const adminSections = [
  {
    title: "Hotels / Locations",
    description: "Manage hotel properties and their settings",
    href: "hotels",
    icon: Building2,
  },
  {
    title: "Orders",
    description: "View and manage guest orders",
    href: "orders",
    icon: ShoppingBag,
  },
];

export default async function AdminPage({ params }: PageProps) {
  const { hotelSlug } = await params;

  const hotelResult = await getHotelBySlug(hotelSlug);
  if (!hotelResult.ok) {
    notFound();
  }

  const hotel = hotelResult.data!;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Managing: {hotel.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {adminSections.map((section) => (
          <Card key={section.href} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <section.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={`/${hotelSlug}/admin/${section.href}`}>
                  Open {section.title}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Utensils className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Quick Access: Restaurants</CardTitle>
              <CardDescription>
                Manage restaurants for {hotel.name}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/${hotelSlug}/admin/hotels/${hotel.id}/restaurants`}>
              Manage Restaurants
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
