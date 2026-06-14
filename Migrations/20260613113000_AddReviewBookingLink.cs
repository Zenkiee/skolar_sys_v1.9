using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using inMVC.Data;

#nullable disable

namespace inMVC.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260613113000_AddReviewBookingLink")]
public partial class AddReviewBookingLink : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "BookingId",
            table: "Reviews",
            type: "INTEGER",
            nullable: true);

        migrationBuilder.Sql("UPDATE Reviews SET Status = 'Published';");

        migrationBuilder.CreateIndex(
            name: "IX_Reviews_BookingId",
            table: "Reviews",
            column: "BookingId",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_Reviews_BookingId",
            table: "Reviews");

        migrationBuilder.DropColumn(
            name: "BookingId",
            table: "Reviews");
    }
}
