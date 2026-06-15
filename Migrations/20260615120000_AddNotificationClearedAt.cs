using System;
using inMVC.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace inMVC.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260615120000_AddNotificationClearedAt")]
    public partial class AddNotificationClearedAt : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastNotificationClearedAt",
                table: "TutorNotificationSettings",
                type: "TEXT",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastNotificationClearedAt",
                table: "TutorNotificationSettings");
        }
    }
}
